// Category page filters, read from and written to the page address so a filtered view can be shared.
import { BREW_METHODS, ORIGINS, ROASTS, type BrewMethod, type Origin, type Product, type Roast } from "@/data/products";
import { TASTE_IDS, tastesOf, type TasteId } from "./taste";

export const SORTS = ["featured", "price-low", "price-high", "name"] as const;
export type Sort = (typeof SORTS)[number];

export interface ShopFilters {
  roast?: Roast;
  taste?: TasteId;
  decaf?: boolean;
  method?: BrewMethod;
  origin?: Origin;
  inStock?: boolean;
  sort: Sort;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pick = <T extends string>(allowed: readonly T[], v: string | undefined) => (allowed as readonly string[]).includes(v ?? "") ? (v as T) : undefined;

/** Unknown or tampered values are ignored, never trusted. */
export function readFilters(params: Params): ShopFilters {
  return {
    roast: pick(ROASTS, one(params.roast)),
    taste: pick(TASTE_IDS, one(params.taste)),
    decaf: one(params.decaf) === "1" || undefined,
    method: pick(BREW_METHODS, one(params.method)),
    origin: pick(ORIGINS, one(params.origin)),
    inStock: one(params.stock) === "1" || undefined,
    sort: pick(SORTS, one(params.sort)) ?? "featured",
  };
}

export function applyFilters(products: readonly Product[], f: ShopFilters): Product[] {
  const kept = products.filter(
    (p) =>
      (!f.roast || p.roast === f.roast) &&
      (!f.taste || tastesOf(p).includes(f.taste)) &&
      (!f.decaf || p.caffeine === "decaf") &&
      (!f.method || p.brewMethods.includes(f.method)) &&
      (!f.origin || p.origins.includes(f.origin)) &&
      (!f.inStock || p.stock > 0),
  );
  const sorted = [...kept];
  if (f.sort === "price-low") sorted.sort((a, b) => a.pricePence - b.pricePence);
  if (f.sort === "price-high") sorted.sort((a, b) => b.pricePence - a.pricePence);
  if (f.sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  // Featured: in-stock first, catalogue order otherwise.
  if (f.sort === "featured") sorted.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  return sorted;
}

export const isFiltered = (f: ShopFilters) => Boolean(f.roast || f.taste || f.decaf || f.method || f.origin || f.inStock);
