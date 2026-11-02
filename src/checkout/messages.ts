// What the basket says when a checkout is refused. Plain words, and only what is true.
import { LIMITS } from "@/config/shop";

export type RefusalReason =
  | "malformed"
  | "empty"
  | "too-many-lines"
  | "too-many-units"
  | "per-product"
  | "busy"
  | "quantity"
  | "duplicate"
  | "unavailable"
  | "grind"
  | "sold-out"
  | "short"
  | "rate-limited"
  | "stripe"
  | "origin";

export function refusalMessage(r: { reason: RefusalReason; name?: string; available?: number }): string {
  const item = r.name ?? "One of your items";
  switch (r.reason) {
    case "sold-out":
      return `${item} has just sold out. Remove it to continue.`;
    case "short":
      return `Only ${r.available} of ${item} left. Lower the quantity to continue.`;
    case "unavailable":
      return `${item} is no longer sold. Remove it to continue.`;
    case "rate-limited":
      return "Too many checkouts from this connection in the last hour. Please try again later.";
    case "stripe":
      return "The test payment page could not be opened. Nothing was charged. Please try again in a minute.";
    case "empty":
      return "Your basket is empty.";
    case "too-many-lines":
      return "That is more lines than one order can hold. Remove some to continue.";
    case "too-many-units":
      return `One order can hold up to ${LIMITS.maxUnitsPerCheckout} items in this demo. Remove some to continue.`;
    case "per-product":
      return `One order can hold up to ${LIMITS.maxQuantityPerProduct} of ${item}, across all grinds. Lower the quantity to continue.`;
    case "busy":
      return `Other visitors are checking out ${item} right now. Lower the quantity, or try again in half an hour.`;
    case "quantity":
      return `Each line can hold up to ${LIMITS.maxQuantityPerLine} of an item.`;
    default:
      return "Something in your basket could not be checked out. Refresh the page and try again.";
  }
}
