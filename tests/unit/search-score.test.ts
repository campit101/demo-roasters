import { describe, expect, it } from "vitest";
import { RULES, scoreCase, scoreRun, type Shown } from "../search/score";
import type { SearchCase } from "../search/types";

const item = (slug: string, pricePence = 1000, stock = 5): Shown => ({ slug, pricePence, stock });

const base: SearchCase = { id: "X", query: "q", acceptable: ["a", "b", "c", "d"], why: "test" };

describe("RULES (locked 23 Oct 2026, never loosened)", () => {
  it("keeps the pass marks exactly as CONSTRAINTS.md states", () => {
    expect(RULES).toEqual({
      lockedCount: 20,
      passMark: 18,
      maxViolations: 0,
      maxAcceptable: 8,
      minMustBeFirst: 4,
      topN: 3,
    });
  });
});

describe("scoreCase", () => {
  it("passes when every top-3 result is acceptable", () => {
    expect(scoreCase(base, [item("b"), item("a"), item("d"), item("zzz")]).passed).toBe(true);
  });

  it("fails when any top-3 result is not acceptable", () => {
    expect(scoreCase(base, [item("a"), item("zzz"), item("b")]).passed).toBe(false);
  });

  it("fails an empty or short answer: at least min(3, acceptable) results are needed", () => {
    expect(scoreCase(base, []).passed).toBe(false);
    expect(scoreCase(base, [item("a"), item("b")]).passed).toBe(false);
    const two = { ...base, acceptable: ["a", "b"] };
    expect(scoreCase(two, [item("b"), item("a")]).passed).toBe(true);
    expect(scoreCase(two, [item("b")]).passed).toBe(false);
  });

  it("requires the named product at number 1 when the case says so", () => {
    const named = { ...base, mustBeFirst: "c" };
    expect(scoreCase(named, [item("a"), item("c"), item("b")]).passed).toBe(false);
    expect(scoreCase(named, [item("c"), item("a"), item("b")]).passed).toBe(true);
  });

  it("counts every shown result that is out of stock or breaks the written price limits, not just the top 3", () => {
    const priced = { ...base, maxPricePence: 1200, minPricePence: 500 };
    const shown = [item("a", 1000), item("b", 1200), item("c", 900), item("x", 1201), item("y", 400), item("z", 800, 0)];
    expect(scoreCase(priced, shown).violations).toEqual(["x over £12.00", "y under £5.00", "z out of stock"]);
  });
});

describe("scoreRun", () => {
  const cases = Array.from({ length: 20 }, (_, i) => ({ ...base, id: `L${i + 1}` }));

  it("passes with 18 of 20 and no violations", () => {
    const answers = cases.map((_, i) => (i < 18 ? [item("a"), item("b"), item("c")] : [item("zzz")]));
    const run = scoreRun(cases, answers);
    expect(run.passedCount).toBe(18);
    expect(run.violationCount).toBe(0);
    expect(run.overall).toBe(true);
  });

  it("fails with 17 of 20", () => {
    const answers = cases.map((_, i) => (i < 17 ? [item("a"), item("b"), item("c")] : [item("zzz")]));
    expect(scoreRun(cases, answers).overall).toBe(false);
  });

  it("fails on a single violation even with 20 of 20", () => {
    const answers = cases.map((_, i) => (i === 0 ? [item("a"), item("b"), item("c"), item("q", 1000, 0)] : [item("a"), item("b"), item("c")]));
    const run = scoreRun(cases, answers);
    expect(run.passedCount).toBe(20);
    expect(run.overall).toBe(false);
  });
});
