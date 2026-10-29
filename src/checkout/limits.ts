// Checkout's per-connection limits, built on the shared limiter (src/lib/rate-limit.ts). Only salted hashes are used.
import { LIMITS } from "@/config/shop";
import { limitKey, type Limit } from "@/lib/rate-limit";

/** At most this many checkouts per connection per hour (CONSTRAINTS.md, "Cost and abuse rules"). */
export const CHECKOUT_HOURLY: Limit = { max: LIMITS.checkoutsPerHourPerConnection, windowSeconds: 3600 };

export const checkoutRateKey = (address: string) => limitKey("checkout", address);

/** Prefix of the rows marking this connection's open checkouts (one open checkout per connection). */
export const openCheckoutKey = (address: string) => limitKey("checkout-open", address);
