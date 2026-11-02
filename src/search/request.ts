// The search page address: the query (`q`) plus any chips the shopper removed (`drop`, repeatable).
// Removing a chip re-runs the same words without that filter; typing a new query starts afresh.
import { MAX_QUERY_LENGTH, type Chip, type Filters, type ParsedQuery } from "./parse";

export const MAX_DROPS = 12;
const DROP_PATTERN = /^[a-z]+(:[A-Za-z -]{1,30})?$/;

export interface SearchRequest {
  q: string;
  drops: string[];
}

type Params = Record<string, string | string[] | undefined>;

export function readSearchRequest(params: Params): SearchRequest {
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  const raw = params.drop === undefined ? [] : Array.isArray(params.drop) ? params.drop : [params.drop];
  return {
    q: q.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH),
    drops: [...new Set(raw.filter((d) => DROP_PATTERN.test(d)))].slice(0, MAX_DROPS),
  };
}

/** "caffeine:decaf", "origin:Costa Rica", or "price" (one chip covers both ends of a range). */
export const chipId = (chip: Chip) => (chip.kind === "price" ? "price" : `${chip.kind}:${chip.value}`);

const FILTER_KEY = { caffeine: "caffeine", roast: "roasts", method: "methods", origin: "origins", category: "categories" } as const;

/** Takes the removed chips out of the parsed query. Removals that match no chip are ignored. */
export function applyDrops(parsed: ParsedQuery, drops: readonly string[]): { parsed: ParsedQuery; dropped: Chip[] } {
  const wanted = new Set(drops);
  const dropped = parsed.chips.filter((c) => wanted.has(chipId(c)));
  if (dropped.length === 0) return { parsed, dropped };
  const filters: Filters = { ...parsed.filters };
  for (const chip of dropped) {
    if (chip.kind === "price") {
      delete filters.minPricePence;
      delete filters.maxPricePence;
      continue;
    }
    const key = FILTER_KEY[chip.kind];
    const left = ((filters[key] ?? []) as string[]).filter((v) => v !== chip.value);
    if (left.length) (filters as Record<string, string[]>)[key] = left;
    else delete filters[key];
  }
  return { parsed: { ...parsed, filters, chips: parsed.chips.filter((c) => !wanted.has(chipId(c))) }, dropped };
}

export function searchHref(q: string, drops: readonly string[] = []): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  for (const d of drops) params.append("drop", d);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}
