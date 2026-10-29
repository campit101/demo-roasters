// The basket's Checkout button posts here. The server prices every line from the database, holds the stock and
// opens Stripe's hosted test-mode page. Only slug, grind and quantity are read from the browser.
import { revalidateTag } from "next/cache";
import { CHECKOUT_HOURLY, checkoutRateKey, openCheckoutKey } from "@/checkout/limits";
import { refusalMessage, type RefusalReason } from "@/checkout/messages";
import { abandonOrder, attachSession, reserveCheckout, settleSession } from "@/checkout/orders";
import { parseCheckoutRequest } from "@/checkout/request";
import { buildSessionParams, sessionExpiry } from "@/checkout/session";
import { getStripe } from "@/checkout/stripe";
import { currentUserIdForOrder } from "@/checkout/user";
import { CATALOGUE_TAG } from "@/db/catalogue";
import { getDb } from "@/db/client";
import { clientAddress, consume } from "@/lib/rate-limit";

function refuse(status: number, r: { reason: RefusalReason; name?: string; available?: number; slug?: string }, headers?: HeadersInit) {
  return Response.json({ ok: false, reason: r.reason, slug: r.slug, available: r.available, message: refusalMessage(r) }, { status, headers });
}

/** The page's own origin, from a same-site request only (Next's server actions check this too; route handlers must). */
function sameOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return null;
  try {
    return new URL(origin).host === host ? origin : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const origin = sameOrigin(req);
  if (!origin) return refuse(403, { reason: "origin" });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return refuse(400, { reason: "malformed" });
  }
  const parsed = parseCheckoutRequest(body);
  if (!parsed.ok) return refuse(400, parsed);

  const db = getDb();
  const address = clientAddress(req.headers);
  const rate = await consume(db, checkoutRateKey(address), CHECKOUT_HOURLY);
  if (!rate.allowed) return refuse(429, { reason: "rate-limited" }, { "Retry-After": String(rate.retryAfterSeconds) });

  const expiresAt = sessionExpiry(new Date());
  const held = await reserveCheckout(db, { lines: parsed.lines, connection: openCheckoutKey(address), userId: await currentUserIdForOrder(), expiresAt });
  if (!held.ok) return refuse(409, held);

  const stripe = getStripe();
  // The connection's earlier Stripe page can no longer be paid. If it was paid a moment ago, record that instead.
  await Promise.allSettled(
    held.replacedSessionIds.map(async (id) => {
      try {
        await stripe.checkout.sessions.expire(id);
      } catch {
        await settleSession(db, await stripe.checkout.sessions.retrieve(id));
      }
    }),
  );

  let url: string | null;
  try {
    const session = await stripe.checkout.sessions.create(
      buildSessionParams({ reference: held.reference, priced: held.priced, origin, returnTo: parsed.returnTo, expiresAt }),
      { idempotencyKey: `order-${held.reference}` },
    );
    await attachSession(db, held.orderId, session.id);
    url = session.url;
  } catch (e) {
    console.error("Stripe Checkout could not be created", e instanceof Error ? e.message : e);
    await abandonOrder(db, held.orderId);
    url = null;
  }
  // Free stock changed (held, or released again): shop pages refresh on their next visit.
  revalidateTag(CATALOGUE_TAG, "max");
  if (!url) return refuse(502, { reason: "stripe" });
  return Response.json({ ok: true, url, reference: held.reference });
}
