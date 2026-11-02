// Building Stripe's hosted Checkout page and reading its result. Pure (no network), so it is unit tested.
// Test mode only: the key guard in ./stripe.ts refuses live keys, and live sessions are refused here.
import type Stripe from "stripe";
import { CHECKOUT, GRIND_LABEL } from "@/config/shop";
import type { Priced } from "./pricing";

const MINUTE = 60_000;

/** When Stripe's page stops accepting payment. */
export const sessionExpiry = (now: Date) => new Date(now.getTime() + CHECKOUT.sessionMinutes * MINUTE);

/** Stock is held until Stripe's expiry plus a margin; after that, free-stock queries ignore the hold. */
export const holdUntil = (expiresAt: Date) => new Date(expiresAt.getTime() + CHECKOUT.holdMarginMinutes * MINUTE);

const REFERENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Order references are random UUIDs; anything else is not an order address. */
export const isReference = (value: string) => REFERENCE.test(value);

export function buildSessionParams(o: {
  reference: string;
  priced: Priced;
  origin: string;
  returnTo: string;
  expiresAt: Date;
}): Stripe.Checkout.SessionCreateParams {
  const line = (name: string, unitPence: number, quantity: number, description?: string): Stripe.Checkout.SessionCreateParams.LineItem => ({
    quantity,
    price_data: {
      currency: CHECKOUT.currency,
      unit_amount: unitPence,
      product_data: description ? { name, description } : { name },
    },
  });
  const items = o.priced.lines.map((l) => line(l.name, l.unitPricePence, l.quantity, l.grind ? groundFor(l.grind) : undefined));
  // Delivery is a line of its own (no address is collected because nothing is posted), so Stripe's total equals ours.
  if (o.priced.deliveryPence > 0) items.push(line("Delivery (demo: nothing is posted)", o.priced.deliveryPence, 1));

  return {
    mode: "payment",
    // Card only: keeps Link and other wallets (and their prompts) off the page. API 2026-09-30 replaced
    // payment_method_types with this filter.
    allowed_payment_method_types: ["card"],
    // The sandbox has Stripe's merchant-of-record service (Managed Payments) on by default, which is for digital
    // goods and refuses custom text. Turned off for this session only; account settings are never changed.
    managed_payments: { enabled: false },
    // A made-up address, so a visitor's real email is never collected.
    customer_email: CHECKOUT.demoEmail,
    line_items: items,
    locale: "en-GB",
    client_reference_id: o.reference,
    metadata: { order_reference: o.reference },
    payment_intent_data: { metadata: { order_reference: o.reference } },
    expires_at: Math.floor(o.expiresAt.getTime() / 1000),
    success_url: `${o.origin}/order/${o.reference}`,
    cancel_url: `${o.origin}/api/checkout/cancel?ref=${o.reference}&back=${encodeURIComponent(o.returnTo)}`,
    custom_text: {
      submit: {
        message: `Demo store in Stripe test mode: no real money is taken and nothing is posted. Use the test card ${CHECKOUT.testCard}, any future date and any CVC.`,
      },
    },
  };
}

function groundFor(grind: keyof typeof GRIND_LABEL): string {
  return grind === "whole-bean" ? "Whole bean" : `Ground for ${GRIND_LABEL[grind].toLowerCase()}`;
}

export type SessionOutcome = "paid" | "open" | "expired" | "refused";

/**
 * What a Stripe session means for one order. Paid only when Stripe says complete and paid, in test mode,
 * for this order's reference, amount and currency; anything that does not match is refused, never paid.
 */
export function sessionOutcome(
  s: Pick<Stripe.Checkout.Session, "livemode" | "status" | "payment_status" | "amount_total" | "currency" | "metadata">,
  order: { reference: string; totalPence: number },
): SessionOutcome {
  if (s.livemode) return "refused";
  if (s.metadata?.order_reference !== order.reference) return "refused";
  if (s.status === "expired") return "expired";
  if (s.status !== "complete" || s.payment_status !== "paid") return "open";
  if (s.amount_total !== order.totalPence || s.currency !== CHECKOUT.currency) return "refused";
  return "paid";
}
