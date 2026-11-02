// Order confirmation. Stripe sends the visitor here after paying; the page asks Stripe directly whether the session
// is paid (so it works without a webhook) and records the payment exactly once. Unknown references are a 404.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { ClearBasketOnce } from "@/components/basket/ClearBasketOnce";
import { CHECKOUT, GRIND_LABEL, LIMITS } from "@/config/shop";
import { findOrder, settleSession, type OrderView } from "@/checkout/orders";
import { isReference } from "@/checkout/session";
import { getStripe } from "@/checkout/stripe";
import { getDb } from "@/db/client";
import { formatPrice } from "@/lib/format";
import { clientAddress, consume, limitKey } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

const WHEN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Asks Stripe about an unpaid order and records what it says. Returns the order as it now stands. */
async function confirmWithStripe(order: OrderView): Promise<{ order: OrderView; payUrl: string | null; checked: boolean }> {
  if (order.status !== "pending" || !order.stripeSessionId) return { order, payUrl: null, checked: true };
  try {
    const db = getDb();
    const rate = await consume(db, limitKey("order-check", clientAddress(await headers())), { max: LIMITS.orderChecksPerHourPerConnection, windowSeconds: 3600 });
    if (!rate.allowed) return { order, payUrl: null, checked: false };
    const session = await getStripe().checkout.sessions.retrieve(order.stripeSessionId);
    const status = await settleSession(db, session);
    const now = status && status !== order.status ? ((await findOrder(db, order.reference)) ?? order) : order;
    return { order: now, payUrl: now.status === "pending" && session.status === "open" ? session.url : null, checked: true };
  } catch (e) {
    console.error("Could not check the order with Stripe", e instanceof Error ? e.message : e);
    return { order, payUrl: null, checked: false };
  }
}

function TestNote() {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-5">
      <p className="label">Test payment</p>
      <p className="mt-2 font-semibold">This is a demo shop in Stripe test mode. No money is taken and nothing is posted.</p>
      <p className="mt-2 text-[0.95rem] text-ink-soft">
        To try a purchase yourself, pay with Stripe’s test card{" "}
        <span translate="no" className="whitespace-nowrap font-semibold text-ink tabular-nums">
          {CHECKOUT.testCard}
        </span>
        ,
        any future expiry date and any three-digit CVC.
      </p>
    </div>
  );
}

function Summary({ order }: { order: OrderView }) {
  return (
    <section aria-labelledby="summary-title" className="rounded-[var(--radius-card)] bg-sand p-5 sm:p-6">
      <h2 id="summary-title" className="text-xl">
        Order summary
      </h2>
      <ul className="mt-4 divide-y divide-line">
        {order.lines.map((l) => (
          <li key={`${l.slug}:${l.grind ?? "none"}`} className="flex gap-4 py-4">
            <Image src={`/products/${l.slug}.webp`} alt="" width={64} height={80} unoptimized className="h-20 w-16 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/products/${l.slug}`} className="font-semibold leading-snug break-words hover:underline">
                    {l.name}
                  </Link>
                  {l.grind && <p className="text-sm text-ink-soft">{GRIND_LABEL[l.grind]}</p>}
                  <p className="text-sm text-ink-soft tabular-nums">
                    {l.quantity} × {formatPrice(l.unitPricePence)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{formatPrice(l.unitPricePence * l.quantity)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <dl className="space-y-1.5 border-t border-line pt-4 text-[0.95rem]">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Subtotal</dt>
          <dd className="tabular-nums">{formatPrice(order.subtotalPence)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Delivery (pretend)</dt>
          <dd className="tabular-nums">{order.deliveryPence === 0 ? "Free" : formatPrice(order.deliveryPence)}</dd>
        </div>
        <div className="flex justify-between pt-1.5 text-lg font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(order.totalPence)}</dd>
        </div>
      </dl>
    </section>
  );
}

function Status({ label, title, done = false, children }: { label: string; title: string; done?: boolean; children: ReactNode }) {
  return (
    <>
      {done && (
        <span className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-ink text-paper" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <p className="label" translate="no">
        {label}
      </p>
      <h1 className="mt-3 text-4xl sm:text-5xl">{title}</h1>
      <div className="mt-5 space-y-3 text-lg text-ink-soft">{children}</div>
    </>
  );
}

export default async function OrderPage({ params }: PageProps<"/order/[reference]">) {
  await connection();
  const { reference } = await params;
  if (!isReference(reference)) notFound();
  const found = await findOrder(getDb(), reference);
  if (!found) notFound();
  const { order, payUrl, checked } = await confirmWithStripe(found);
  const number = `Order ${order.reference.slice(0, 8).toUpperCase()}`;

  let status: ReactNode;
  let actions: ReactNode = (
    <Link href="/shop/coffee" className="btn btn-primary">
      Continue shopping
    </Link>
  );
  if (order.status === "paid") {
    status = (
      <Status label={number} title="Thank you. Your test order is confirmed." done>
        <p>Paid with a test card{order.paidAt ? ` on ${WHEN.format(order.paidAt)}` : ""}.</p>
        <p>
          A real shop would email you a receipt and post your coffee. This demo sends no emails and posts nothing, so keep this page’s
          address if you want to see the order again.
        </p>
      </Status>
    );
  } else if (order.status === "pending") {
    status = (
      <Status label={number} title={checked ? "Waiting for your test payment" : "This payment could not be checked just now"}>
        {checked ? (
          <p>Stripe has not received a payment for this order yet. Your items are held for you until {TIME.format(order.reservedUntil)}.</p>
        ) : (
          <p>Stripe did not answer. Nothing has changed with your order: refresh the page in a moment to check again.</p>
        )}
      </Status>
    );
    actions = (
      <>
        {payUrl && (
          <a href={payUrl} className="btn btn-primary">
            Return to the payment page
          </a>
        )}
        <a href={`/api/checkout/cancel?ref=${order.reference}&back=%2Fshop%2Fcoffee`} className={payUrl ? "btn btn-secondary" : "btn btn-primary"}>
          Cancel this checkout
        </a>
      </>
    );
  } else {
    status = (
      <Status label={number} title={order.status === "expired" ? "This checkout expired before payment" : "This checkout was cancelled"}>
        <p>Nothing was charged and the items were released. Your basket is still saved on this device.</p>
      </Status>
    );
  }

  // Phones read top to bottom: what happened, what to do, the order, then the test note. Desktop puts the summary
  // in a column on the right, as the reference shops do.
  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-16">
      {order.status === "paid" && <ClearBasketOnce reference={order.reference} />}
      <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="max-w-2xl">
          {status}
          <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <Summary order={order} />
        </div>
        <div className="max-w-2xl lg:col-start-1">
          <TestNote />
        </div>
      </div>
    </div>
  );
}
