// Prices a checkout from the database rows alone. Pure, so every refusal rule is unit tested.
import { CHECKOUT, LIMITS, type Grind } from "@/config/shop";
import { basketTotals } from "@/lib/basket";
import type { CheckoutLineRequest } from "./request";

/** A product as the checkout sees it: free stock already has other visitors' unexpired holds taken off. */
export interface StockedProduct {
  id: number;
  slug: string;
  name: string;
  category: "beans" | "gear" | "bundle";
  pricePence: number;
  active: boolean;
  freeStock: number;
  /** Units this checkout may still hold under the hold share (CHECKOUT.maxHeldShare); absent means no hold limit. */
  holdRoom?: number;
}

/** Units checkouts may hold of a product with this much stock, minus what is already held (at least one unit in all). */
export const holdRoomFor = (stock: number, held: number) => Math.max(1, Math.ceil(stock * CHECKOUT.maxHeldShare)) - held;

export interface PricedLine {
  productId: number;
  slug: string;
  name: string;
  grind: Grind | null;
  quantity: number;
  unitPricePence: number;
}

export type Priced = { ok: true; lines: PricedLine[]; subtotalPence: number; deliveryPence: number; totalPence: number };

export type PriceRefusal =
  | { ok: false; reason: "unavailable" | "grind"; slug: string }
  | { ok: false; reason: "sold-out" | "short"; slug: string; name: string; available: number }
  | { ok: false; reason: "per-product" | "busy"; slug: string; name: string };

export function priceLines(lines: CheckoutLineRequest[], products: ReadonlyMap<string, StockedProduct>): Priced | PriceRefusal {
  const wanted = new Map<string, number>();
  const priced: PricedLine[] = [];
  for (const l of lines) {
    const p = products.get(l.slug);
    if (!p || !p.active) return { ok: false, reason: "unavailable", slug: l.slug };
    // Coffee is always ground one way (whole bean included); gear and gift sets never are.
    if ((p.category === "beans") !== (l.grind !== null)) return { ok: false, reason: "grind", slug: l.slug };
    wanted.set(p.slug, (wanted.get(p.slug) ?? 0) + l.quantity);
    priced.push({ productId: p.id, slug: p.slug, name: p.name, grind: l.grind, quantity: l.quantity, unitPricePence: p.pricePence });
  }
  // One coffee in two grinds draws on the same stock.
  for (const [slug, quantity] of wanted) {
    const p = products.get(slug)!;
    const available = Math.max(0, p.freeStock);
    if (available === 0) return { ok: false, reason: "sold-out", slug, name: p.name, available };
    if (quantity > available) return { ok: false, reason: "short", slug, name: p.name, available };
    if (quantity > LIMITS.maxQuantityPerProduct) return { ok: false, reason: "per-product", slug, name: p.name };
    if (p.holdRoom !== undefined && quantity > p.holdRoom) return { ok: false, reason: "busy", slug, name: p.name };
  }
  // Same delivery rule as the basket drawer, applied to the database prices.
  const totals = basketTotals({ lines: priced.map((l) => ({ slug: l.slug, name: l.name, grind: l.grind, quantity: l.quantity, pricePence: l.unitPricePence })) });
  return { ok: true, lines: priced, subtotalPence: totals.subtotalPence, deliveryPence: totals.deliveryPence, totalPence: totals.totalPence };
}
