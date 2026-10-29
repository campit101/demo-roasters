// Marks the search test exactly as CONSTRAINTS.md "Search test" states. Locked 23 Oct 2026: never loosened.
import type { SearchCase } from "./types";

export const RULES = {
  lockedCount: 20,
  passMark: 18,
  maxViolations: 0,
  maxAcceptable: 8,
  minMustBeFirst: 4,
  topN: 3,
} as const;

/** What the search showed for one result, read from the database at the time of the search. */
export interface Shown {
  slug: string;
  pricePence: number;
  stock: number;
}

export interface CaseResult {
  id: string;
  query: string;
  passed: boolean;
  shownTop: string[];
  violations: string[];
}

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export function scoreCase(c: SearchCase, shown: readonly Shown[]): CaseResult {
  const top = shown.slice(0, RULES.topN);
  const needed = Math.min(RULES.topN, c.acceptable.length);
  const passed =
    top.length >= needed &&
    top.every((s) => c.acceptable.includes(s.slug)) &&
    (c.mustBeFirst === undefined || top[0]?.slug === c.mustBeFirst);

  const violations: string[] = [];
  for (const s of shown) {
    if (c.maxPricePence !== undefined && s.pricePence > c.maxPricePence) violations.push(`${s.slug} over ${pounds(c.maxPricePence)}`);
    if (c.minPricePence !== undefined && s.pricePence < c.minPricePence) violations.push(`${s.slug} under ${pounds(c.minPricePence)}`);
    if (s.stock <= 0) violations.push(`${s.slug} out of stock`);
  }
  return { id: c.id, query: c.query, passed, shownTop: top.map((s) => s.slug), violations };
}

export function scoreRun(cases: readonly SearchCase[], answers: readonly (readonly Shown[])[]) {
  const results = cases.map((c, i) => scoreCase(c, answers[i] ?? []));
  const passedCount = results.filter((r) => r.passed).length;
  const violationCount = results.reduce((n, r) => n + r.violations.length, 0);
  return {
    results,
    passedCount,
    violationCount,
    overall: passedCount >= RULES.passMark && violationCount <= RULES.maxViolations,
  };
}
