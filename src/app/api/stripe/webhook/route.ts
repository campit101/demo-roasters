// Stripe's signed webhook (set up on production at launch). Refuses anything unsigned, wrongly signed or live.
import { revalidateTag } from "next/cache";
import { settleSession } from "@/checkout/orders";
import { handleStripeWebhook } from "@/checkout/webhook";
import { CATALOGUE_TAG } from "@/db/catalogue";
import { getDb } from "@/db/client";

export async function POST(req: Request) {
  // The signature covers the exact bytes Stripe sent, so read the body as text before anything parses it.
  const body = await req.text();
  const result = await handleStripeWebhook(body, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET, {
    onPaid: async (session) => void (await settleSession(getDb(), session)),
    onExpired: async (session) => {
      await settleSession(getDb(), session);
      revalidateTag(CATALOGUE_TAG, "max");
    },
  });
  return new Response(result.body, { status: result.status });
}
