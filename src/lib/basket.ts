// The basket: pure functions, so the rules are tested apart from the page. It is kept on the visitor's own
// device (localStorage); at checkout only slug, grind and quantity are sent, and the server re-prices every line
// from the database (src/checkout/pricing.ts), never trusting these numbers.
import { DELIVERY, GRINDS, LIMITS, type Grind } from "@/config/shop";

export interface BasketItem {
  slug: string;
  name: string;
  pricePence: number;
  /** Coffee only; null for gear and gift sets. */
  grind: Grind | null;
}

export interface BasketLine extends BasketItem {
  quantity: number;
}

export interface Basket {
  lines: BasketLine[];
}

export const EMPTY: Basket = { lines: [] };

export const lineKey = (l: Pick<BasketItem, "slug" | "grind">) => `${l.slug}:${l.grind ?? "none"}`;

const clamp = (n: number) => Math.min(LIMITS.maxQuantityPerLine, Math.max(1, Math.floor(n)));

/** The most a line may hold: the per-line cap, what is left of one product's cap across its grinds, and what is left
 *  of the per-order cap (the same rules checkout applies, so the basket never offers what checkout would refuse). */
function lineMax(b: Basket, item: Pick<BasketItem, "slug" | "grind">): number {
  const key = lineKey(item);
  const others = b.lines.filter((l) => lineKey(l) !== key);
  const sameProduct = others.filter((l) => l.slug === item.slug).reduce((n, l) => n + l.quantity, 0);
  const all = others.reduce((n, l) => n + l.quantity, 0);
  return Math.min(LIMITS.maxQuantityPerLine, LIMITS.maxQuantityPerProduct - sameProduct, LIMITS.maxUnitsPerCheckout - all);
}

/** How many more of this line the basket can take. */
export function roomFor(b: Basket, item: Pick<BasketItem, "slug" | "grind">): number {
  const current = b.lines.find((l) => lineKey(l) === lineKey(item))?.quantity ?? 0;
  return Math.max(0, lineMax(b, item) - current);
}

export function addLine(b: Basket, item: BasketItem, quantity: number): Basket {
  const key = lineKey(item);
  const existing = b.lines.find((l) => lineKey(l) === key);
  if (existing) return setQuantity(b, key, existing.quantity + quantity);
  const max = lineMax(b, item);
  if (max < 1) return b;
  return { lines: [...b.lines, { ...item, quantity: Math.min(max, clamp(quantity)) }] };
}

export function setQuantity(b: Basket, key: string, quantity: number): Basket {
  return { lines: b.lines.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.max(1, Math.min(lineMax(b, l), clamp(quantity))) } : l)) };
}

export function removeLine(b: Basket, key: string): Basket {
  return { lines: b.lines.filter((l) => lineKey(l) !== key) };
}

export function basketTotals(b: Basket) {
  const itemCount = b.lines.reduce((n, l) => n + l.quantity, 0);
  const subtotalPence = b.lines.reduce((n, l) => n + l.pricePence * l.quantity, 0);
  const free = subtotalPence >= DELIVERY.freeFromPence;
  const deliveryPence = itemCount === 0 || free ? 0 : DELIVERY.flatPence;
  return {
    itemCount,
    subtotalPence,
    deliveryPence,
    totalPence: subtotalPence + deliveryPence,
    toFreeDeliveryPence: itemCount === 0 || free ? 0 : DELIVERY.freeFromPence - subtotalPence,
  };
}

const isLine = (x: unknown): x is BasketLine => {
  if (!x || typeof x !== "object") return false;
  const l = x as Record<string, unknown>;
  return (
    typeof l.slug === "string" &&
    /^[a-z0-9-]{1,80}$/.test(l.slug) &&
    typeof l.name === "string" &&
    l.name.length <= 120 &&
    Number.isInteger(l.pricePence) &&
    (l.pricePence as number) > 0 &&
    (l.grind === null || (GRINDS as readonly string[]).includes(l.grind as string)) &&
    Number.isInteger(l.quantity) &&
    (l.quantity as number) >= 1
  );
};

/** Reads a saved basket. Anything malformed or tampered is dropped; quantities are capped. */
export function parseBasket(raw: string | null): Basket {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as { lines?: unknown };
    if (!Array.isArray(data.lines)) return EMPTY;
    return { lines: data.lines.filter(isLine).slice(0, LIMITS.maxLinesPerCheckout).map((l) => ({ ...l, quantity: clamp(l.quantity) })) };
  } catch {
    return EMPTY;
  }
}
