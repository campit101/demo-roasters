// Stripe's webhook: only signed test-mode events are accepted. The real endpoint is set up on production at launch
// (Cam, 25 Oct); locally and on previews the order page confirms each payment with Stripe instead.
import Stripe from "stripe";

export interface WebhookHandlers {
  onPaid: (session: Stripe.Checkout.Session) => Promise<void>;
  onExpired: (session: Stripe.Checkout.Session) => Promise<void>;
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
  handlers: WebhookHandlers,
): Promise<{ status: number; body: string }> {
  if (!secret) return { status: 503, body: "Webhook is not set up here" };
  if (!signature) return { status: 400, body: "Missing signature" };
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return { status: 400, body: "Bad signature" };
  }
  if (event.livemode) return { status: 400, body: "Live events are refused" };
  switch (event.type) {
    case "checkout.session.completed":
      await handlers.onPaid(event.data.object);
      break;
    case "checkout.session.expired":
      await handlers.onExpired(event.data.object);
      break;
    default:
      return { status: 200, body: "Ignored" };
  }
  return { status: 200, body: "OK" };
}
