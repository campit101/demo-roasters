// One search, end to end: parse the words into filters and meaning words, apply any removed chips, check the
// limits, turn the query into a meaning vector (free model, skipped once the daily ceiling is reached), read the
// products that pass every hard rule from the database, rank them, and log the search without its text.
// Every outside effect is passed in, so the whole flow is tested without a database or model.
import type { Candidate } from "./candidates";
import type { Allowance } from "./limits";
import { parseQuery, type Chip, type Filters, type ParsedQuery } from "./parse";
import { rankProducts, type Ranked } from "./rank";
import { applyDrops, type SearchRequest } from "./request";

export type Layer = "parser+keyword+meaning" | "parser+keyword";
export type KeywordOnlyReason = "daily-limit" | "model-unavailable";

/** What search_events keeps: never the search text. */
export interface SearchEvent {
  resultCount: number;
  durationMs: number;
  layer: Layer;
  costMicropence: 0;
}

export interface SearchDeps {
  allowance: () => Promise<Allowance>;
  embed: (text: string) => Promise<number[]>;
  candidates: (filters: Filters, vector: number[] | null) => Promise<Candidate[]>;
  record: (event: SearchEvent) => void;
  clock?: () => number;
  onError?: (error: unknown) => void;
}

export type SearchOutcome =
  | { status: "idle" }
  | { status: "limited"; parsed: ParsedQuery; dropped: Chip[]; retryAfterSeconds: number }
  | {
      status: "done";
      parsed: ParsedQuery;
      dropped: Chip[];
      results: Ranked[];
      /** No product matched the meaning words, so results come from the filters alone. */
      loose: boolean;
      /** Meaning words were given but no result contains any of them: results are the closest by meaning. */
      meaningOnly: boolean;
      keywordOnly: KeywordOnlyReason | null;
      layer: Layer;
    };

/** The text given to the meaning model: the meaning words first, then the whole query (as tuned in T3). */
export const meaningText = (parsed: ParsedQuery) => [...parsed.terms, parsed.raw].join(" ");

export async function runSearch(request: SearchRequest, deps: SearchDeps): Promise<SearchOutcome> {
  if (!request.q) return { status: "idle" };
  const clock = deps.clock ?? (() => performance.now());
  const started = clock();
  const { parsed, dropped } = applyDrops(parseQuery(request.q), request.drops);

  const allowance = await deps.allowance();
  if (!allowance.allowed) return { status: "limited", parsed, dropped, retryAfterSeconds: allowance.retryAfterSeconds };

  let vector: number[] | null = null;
  let keywordOnly: KeywordOnlyReason | null = null;
  if (!allowance.meaning) keywordOnly = "daily-limit";
  else {
    try {
      vector = await deps.embed(meaningText(parsed));
    } catch (error) {
      deps.onError?.(error);
      keywordOnly = "model-unavailable";
    }
  }

  const found = await deps.candidates(parsed.filters, vector);
  const semantic = new Map(found.flatMap((c) => (c.similarity === null ? [] : [[c.slug, c.similarity] as const])));
  const results = rankProducts(found, parsed, { semantic });
  const layer: Layer = vector ? "parser+keyword+meaning" : "parser+keyword";
  deps.record({ resultCount: results.length, durationMs: Math.round(clock() - started), layer, costMicropence: 0 });

  return {
    status: "done",
    parsed,
    dropped,
    results,
    loose: results[0]?.loose ?? false,
    meaningOnly: parsed.terms.length > 0 && results.length > 0 && !results[0]!.loose && results.every((r) => r.keyword === 0),
    keywordOnly,
    layer,
  };
}
