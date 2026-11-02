// Display helpers. Money is stored in whole pence and shown in pounds.

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export const formatPrice = (pence: number) => GBP.format(pence / 100);
const WHOLE = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
/** "£30" for whole-pound amounts such as delivery thresholds; "£3.95" otherwise. */
export const formatPounds = (pence: number) => (pence % 100 === 0 ? WHOLE.format(pence / 100) : formatPrice(pence));

export const ROAST_LABEL = { light: "Light", medium: "Medium", "medium-dark": "Medium-dark", dark: "Dark" } as const;

export const METHOD_LABEL = {
  espresso: "Espresso",
  "pour-over": "Pour-over",
  "batch-brew": "Filter machine",
  cafetiere: "Cafetière",
  "hand-press": "Hand press",
  "moka-pot": "Moka pot",
  "cold-brew": "Cold brew",
} as const;

/** "Brazil", "Brazil and Colombia", "Brazil, Colombia and Honduras" */
export function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The small spaced line above a product name: where it is from and how it is roasted, or what it is. */
export function cardLine(p: { category: string; origins: readonly string[]; size: string; caffeine: string | null; roast: keyof typeof ROAST_LABEL | null }): string {
  if (p.category === "beans") {
    const where = p.origins.length > 1 ? "Blend" : (p.origins[0] ?? "");
    return [where, p.roast ? `${ROAST_LABEL[p.roast]} roast` : "", p.caffeine === "decaf" ? "Decaf" : ""].filter(Boolean).join(" · ");
  }
  return p.category === "gear" ? `Brewing gear · ${p.size}` : `Gift set · ${p.size}`;
}
