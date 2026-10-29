// The Stripe client. Test mode only, forever: any key that is not a test key is refused before a request is made.
import Stripe from "stripe";
import { assertTestStripeKey } from "@/lib/guards";

export function createStripe(key: string | undefined): Stripe {
  return new Stripe(assertTestStripeKey(key), { maxNetworkRetries: 2, timeout: 20_000 });
}

let client: Stripe | undefined;
export const getStripe = () => (client ??= createStripe(process.env.STRIPE_SECRET_KEY));
