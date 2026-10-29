// Stripe's "back" link lands here. The Stripe page is expired so it can no longer be paid, the hold is released,
// and the visitor goes back to the page they came from with their basket open and untouched.
import { revalidateTag } from "next/cache";
import { findOrder, releaseHold, settleSession } from "@/checkout/orders";
import { safeReturnPath } from "@/checkout/request";
import { isReference } from "@/checkout/session";
import { getStripe } from "@/checkout/stripe";
import { CATALOGUE_TAG } from "@/db/catalogue";
import { getDb } from "@/db/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref") ?? "";
  const back = new URL(safeReturnPath(url.searchParams.get("back")), url.origin);
  back.searchParams.set("checkout", "cancelled");

  if (isReference(ref)) {
    const db = getDb();
    const order = await findOrder(db, ref);
    if (order?.status === "pending" && order.stripeSessionId) {
      const stripe = getStripe();
      let status: string | null = "cancelled";
      try {
        await stripe.checkout.sessions.expire(order.stripeSessionId);
        await releaseHold(db, order.stripeSessionId, "cancelled");
      } catch {
        // Already finished at Stripe (paid a moment ago, or expired): record what Stripe says.
        status = await settleSession(db, await stripe.checkout.sessions.retrieve(order.stripeSessionId));
      }
      revalidateTag(CATALOGUE_TAG, "max");
      if (status === "paid") return Response.redirect(new URL(`/order/${ref}`, url.origin), 303);
    }
  }
  return Response.redirect(back, 303);
}
