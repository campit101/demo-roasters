// Ranks catalogue products for a parsed query. Hard rules (stock, price, filters) are applied first and
// can never be outweighed; inside them, products are ordered by keyword meaning plus an optional
// embedding similarity per product (supplied by the caller from the database in T3).
import type { BrewMethod, Product } from "@/data/products";
import type { Filters, ParsedQuery } from "./parse";

export const RESULT_LIMIT = 24;

/** Weight of the meaning score (0 to 1, relative to this search) against keyword points. */
export const SEMANTIC_WEIGHT = 2;
/** gte-small rates most coffee texts alike (about 0.72 to 0.93), so meaning is judged within each search:
 * 0 = least similar eligible product, 1 = most similar. A spread narrower than this means no real signal. */
export const SEMANTIC_MIN_SPREAD = 0.03;
/** A product with no keyword match is kept only if its relative meaning score reaches this. */
export const SEMANTIC_RELATIVE_FLOOR = 0.85;
/** With meaning words, results scoring under this share of the best match are left out as weak.
 * 0.3 keeps a description-only mention (1 point) alongside a name match (3 points). */
export const RELATIVE_CUTOFF = 0.3;

export interface RankOptions {
  semantic?: ReadonlyMap<string, number>;
  limit?: number;
}

export interface Ranked {
  product: Product;
  score: number;
  keyword: number;
  semantic: number;
  /** True when no product matched the meaning words, so results come from the filters alone. */
  loose: boolean;
}

// ── Hard rules ───────────────────────────────────────────────────────────────────────────────────

const overlaps = <T>(have: readonly T[], want?: readonly T[]) => !want?.length || have.some((v) => want.includes(v));

export function matchesFilters(p: Product, f: Filters): boolean {
  if (p.stock <= 0) return false;
  if (f.maxPricePence !== undefined && p.pricePence > f.maxPricePence) return false;
  if (f.minPricePence !== undefined && p.pricePence < f.minPricePence) return false;
  if (f.caffeine?.length && (p.caffeine === null || !f.caffeine.includes(p.caffeine))) return false;
  if (f.roasts?.length && (p.roast === null || !f.roasts.includes(p.roast))) return false;
  if (f.categories?.length && !f.categories.includes(p.category)) return false;
  if (!overlaps(p.origins, f.origins)) return false;
  if (!overlaps(p.brewMethods, f.methods)) return false;
  return true;
}

// ── Meaning ──────────────────────────────────────────────────────────────────────────────────────

/** Flavour and intent families: a shopper's word matches any word in its family, at a lower weight. */
const FAMILIES: readonly (readonly string[])[] = [
  ["fruity", "fruit", "fruits", "berry", "berries", "blueberry", "strawberry", "blackcurrant", "cherry", "apple", "peach", "apricot", "plum", "grapefruit", "lemon", "orange", "tangerine", "lime", "citrus", "jammy", "juicy", "wine"],
  ["chocolatey", "chocolaty", "chocolate", "cocoa", "cacao"],
  ["nutty", "nut", "nuts", "hazelnut", "almond", "peanut", "walnut"],
  ["floral", "flowery", "flowers", "jasmine", "hibiscus", "bergamot", "tea-like", "delicate"],
  ["sweet", "caramel", "toffee", "honey", "honeyed", "sugar", "molasses", "treacle", "syrupy"],
  ["smoky", "smokey", "smoke", "smokiness", "cedar", "earthy", "spice", "spicy"],
  ["smooth", "mellow", "gentle", "soft", "silky", "balanced", "rounded", "round", "easy", "comforting"],
  ["strong", "bold", "punchy", "intense", "heavy", "rich", "traditional"],
  ["bright", "juicy", "crisp", "clean", "lively", "zesty"],
  ["iced", "ice", "cold", "fridge", "steep", "chilled"],
  ["gift", "gifts", "present", "presents", "box", "set", "bundle", "hamper"],
  ["starter", "beginner", "beginners", "start", "first", "everything", "kit", "set"],
  ["cheap", "budget", "affordable", "value", "everyday"],
  ["special", "occasion", "rare", "treat", "reserve", "tiny"],
];

const familyOf = (term: string): readonly string[] => FAMILIES.find((f) => f.includes(term)) ?? [];
const GIFT_WORDS = new Set(FAMILIES[10]);

const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .flatMap((w) => [w, ...(w.includes("-") ? w.split("-") : [])])
    .filter(Boolean);

/** Same word, or a near-identical ending (chocolate / chocolatey), but not small / smallholding. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.length - short.length <= 3 && long.startsWith(short);
}

interface ProductText {
  name: string[];
  notes: string[];
  description: string[];
  nameText: string;
  notesText: string;
  descriptionText: string;
}

const textCache = new WeakMap<Product, ProductText>();
function textOf(p: Product): ProductText {
  let t = textCache.get(p);
  if (!t) {
    const notesText = p.flavourNotes.join(" ").toLowerCase();
    t = {
      name: words(p.name),
      notes: words(notesText),
      description: words(p.description),
      nameText: p.name.toLowerCase(),
      notesText,
      descriptionText: p.description.toLowerCase(),
    };
    textCache.set(p, t);
  }
  return t;
}

function termScore(p: Product, term: string): number {
  const t = textOf(p);
  if (term.includes(" ")) {
    if (t.nameText.includes(term)) return 3;
    if (t.notesText.includes(term)) return 2.5;
    return t.descriptionText.includes(term) ? 1 : 0;
  }
  const has = (list: string[], w: string) => list.some((x) => sameWord(x, w));
  let best = has(t.name, term) ? 3 : has(t.notes, term) ? 2.5 : has(t.description, term) ? 1 : 0;
  for (const relative of familyOf(term)) {
    if (relative === term) continue;
    const s = has(t.name, relative) ? 1.5 : has(t.notes, relative) ? 2 : has(t.description, relative) ? 0.8 : 0;
    best = Math.max(best, s);
  }
  if (GIFT_WORDS.has(term) && p.category === "bundle") best += 2;
  return best;
}

// ── How well a product fits the filters it passed ───────────────────────────────────────────────

const NAME_HINTS: Partial<Record<BrewMethod | "decaf", readonly string[]>> = {
  espresso: ["espresso"],
  "cold-brew": ["cold brew", "cold"],
  "pour-over": ["pour-over", "filter", "dripper"],
  "batch-brew": ["filter", "batch"],
  cafetiere: ["cafetière", "cafetiere"],
  "moka-pot": ["moka", "stovetop"],
  "hand-press": ["press"],
  decaf: ["decaf"],
};

function filterFit(p: Product, f: Filters): number {
  let fit = 0;
  if (f.origins?.length && p.origins.length) fit += 1 / p.origins.length;
  const name = p.name.toLowerCase();
  if (f.methods?.length) {
    const positions = f.methods.map((m) => p.brewMethods.indexOf(m)).filter((i) => i >= 0);
    if (positions.length) fit += 1 / (Math.min(...positions) + 1);
    if (f.methods.some((m) => NAME_HINTS[m]?.some((h) => name.includes(h)))) fit += 0.6;
  }
  if (f.caffeine?.includes("decaf") && NAME_HINTS.decaf!.some((h) => name.includes(h))) fit += 0.3;
  return fit;
}

// ── Rank ─────────────────────────────────────────────────────────────────────────────────────────

export function rankProducts(products: readonly Product[], parsed: ParsedQuery, options: RankOptions = {}): Ranked[] {
  const { semantic, limit = RESULT_LIMIT } = options;
  const avoided = (p: Product) => {
    const t = textOf(p);
    return parsed.avoid.some((w) => t.nameText.includes(w) || t.notesText.includes(w) || t.descriptionText.includes(w));
  };
  const eligible = products.filter((p) => matchesFilters(p, parsed.filters) && !avoided(p));

  const raw = eligible.map((p) => semantic?.get(p.slug)).filter((s): s is number => s !== undefined);
  const low = Math.min(...raw);
  const spread = Math.max(...raw) - low;
  const relative = (slug: string) => {
    const s = semantic?.get(slug);
    return s === undefined || !(spread >= SEMANTIC_MIN_SPREAD) ? 0 : (s - low) / spread;
  };

  const scored = eligible.map((product) => {
    const keyword = parsed.terms.reduce((sum, term) => sum + termScore(product, term), 0);
    const sem = relative(product.slug);
    return { product, keyword, semantic: sem, score: keyword + filterFit(product, parsed.filters) + SEMANTIC_WEIGHT * sem };
  });

  let kept = scored;
  let loose = false;
  if (parsed.terms.length > 0) {
    kept = scored.filter((r) => r.keyword > 0 || r.semantic >= SEMANTIC_RELATIVE_FLOOR);
    const relevance = (r: (typeof scored)[number]) => r.keyword + SEMANTIC_WEIGHT * r.semantic;
    const best = Math.max(0, ...kept.map(relevance));
    kept = kept.filter((r) => relevance(r) >= RELATIVE_CUTOFF * best);
    if (kept.length === 0) {
      kept = scored;
      loose = true;
    }
  }

  return kept
    .sort((a, b) => b.score - a.score || a.product.pricePence - b.product.pricePence || a.product.slug.localeCompare(b.product.slug))
    .slice(0, limit)
    .map((r) => ({ ...r, loose }));
}
