import { describe, expect, it, vi } from "vitest";
import { PRODUCTS } from "@/data/products";
import type { Candidate } from "@/search/candidates";
import { parseQuery, type Filters } from "@/search/parse";
import { matchesFilters } from "@/search/rank";
import { meaningText, runSearch, type SearchDeps, type SearchEvent } from "@/search/run";
import { createVectorCache } from "@/search/vector-cache";

// A stand-in database: the catalogue file through the same hard rules, with a made-up similarity per product.
const fakeCandidates = vi.fn(async (filters: Filters, vector: number[] | null): Promise<Candidate[]> =>
  PRODUCTS.filter((p) => matchesFilters(p, filters)).map((p, i) => ({ ...p, similarity: vector ? 0.7 + (i % 10) / 50 : null })),
);

function deps(overrides: Partial<SearchDeps> = {}): SearchDeps & { events: SearchEvent[] } {
  const events: SearchEvent[] = [];
  let t = 0;
  return {
    allowance: async () => ({ allowed: true, meaning: true }),
    embed: vi.fn(async () => [0.1, 0.2]),
    candidates: fakeCandidates,
    record: (e) => events.push(e),
    clock: () => (t += 12.4),
    events,
    ...overrides,
  };
}

describe("runSearch", () => {
  it("does nothing for an empty query (no limit used, nothing logged)", async () => {
    const d = deps({ allowance: vi.fn(async () => ({ allowed: true as const, meaning: true })) });
    expect(await runSearch({ q: "", drops: [] }, d)).toEqual({ status: "idle" });
    expect(d.allowance).not.toHaveBeenCalled();
    expect(d.events).toEqual([]);
  });

  it("runs parser, keywords and the meaning model, and returns only in-stock products within the filters", async () => {
    const d = deps();
    const out = await runSearch({ q: "decafe coffee under £12", drops: [] }, d);
    expect(out.status).toBe("done");
    if (out.status !== "done") return;
    expect(out.layer).toBe("parser+keyword+meaning");
    expect(out.keywordOnly).toBeNull();
    expect(out.results.length).toBeGreaterThan(0);
    for (const r of out.results) {
      expect(r.product.stock).toBeGreaterThan(0);
      expect(r.product.pricePence).toBeLessThanOrEqual(1200);
      expect(r.product.caffeine).toBe("decaf");
    }
    expect(d.embed).toHaveBeenCalledWith(meaningText(parseQuery("decafe coffee under £12")));
  });

  it("logs result count, time taken, layers and zero cost, and never the search text", async () => {
    const d = deps();
    const out = await runSearch({ q: "fruity light roast for filter", drops: [] }, d);
    expect(d.events).toHaveLength(1);
    const event = d.events[0]!;
    expect(Object.keys(event).sort()).toEqual(["costMicropence", "durationMs", "layer", "resultCount"]);
    expect(event).toEqual({ resultCount: out.status === "done" ? out.results.length : -1, durationMs: 12, layer: "parser+keyword+meaning", costMicropence: 0 });
    expect(JSON.stringify(event)).not.toMatch(/fruity|filter/);
  });

  it("re-runs without a removed chip", async () => {
    const d = deps();
    const out = await runSearch({ q: "decaf espresso", drops: ["caffeine:decaf"] }, d);
    if (out.status !== "done") throw new Error(out.status);
    expect(out.dropped.map((c) => c.label)).toEqual(["Decaf"]);
    expect(out.parsed.chips.map((c) => c.label)).toEqual(["Espresso"]);
    expect(fakeCandidates).toHaveBeenLastCalledWith({ methods: ["espresso"] }, [0.1, 0.2]);
    expect(out.results.some((r) => r.product.caffeine === "regular")).toBe(true);
  });

  it("says so and runs nothing when this connection is over its limit", async () => {
    const d = deps({ allowance: async () => ({ allowed: false, retryAfterSeconds: 42 }) });
    const out = await runSearch({ q: "nutty", drops: [] }, d);
    expect(out).toMatchObject({ status: "limited", retryAfterSeconds: 42 });
    expect(d.embed).not.toHaveBeenCalled();
    expect(d.events).toEqual([]);
  });

  it("falls back to keywords only, and says why, once the daily ceiling is reached", async () => {
    const d = deps({ allowance: async () => ({ allowed: true, meaning: false }) });
    const out = await runSearch({ q: "nutty coffee under 10 quid", drops: [] }, d);
    if (out.status !== "done") throw new Error(out.status);
    expect(d.embed).not.toHaveBeenCalled();
    expect(out.keywordOnly).toBe("daily-limit");
    expect(out.layer).toBe("parser+keyword");
    expect(out.results.map((r) => r.product.slug)).toContain("cerrado-sunset");
    expect(d.events[0]!.layer).toBe("parser+keyword");
  });

  it("still answers with keywords if the meaning model fails", async () => {
    const onError = vi.fn();
    const d = deps({ embed: async () => Promise.reject(new Error("model missing")), onError });
    const out = await runSearch({ q: "chocolatey espresso", drops: [] }, d);
    if (out.status !== "done") throw new Error(out.status);
    expect(out.keywordOnly).toBe("model-unavailable");
    expect(out.results.length).toBeGreaterThan(0);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("returns an honest empty result when nothing passes the filters", async () => {
    const out = await runSearch({ q: "decaf under £3", drops: [] }, deps());
    if (out.status !== "done") throw new Error(out.status);
    expect(out.results).toEqual([]);
  });

  it("flags results that match by meaning only, so the page can say so", async () => {
    const out = await runSearch({ q: "zxqv wobble", drops: [] }, deps());
    if (out.status !== "done") throw new Error(out.status);
    expect(out.meaningOnly).toBe(true);
    const words = await runSearch({ q: "nutty", drops: [] }, deps());
    if (words.status !== "done") throw new Error(words.status);
    expect(words.meaningOnly).toBe(false);
  });
});

describe("createVectorCache", () => {
  it("reuses the vector for a repeated query and keeps only the most recent ones", async () => {
    const embedOne = vi.fn(async (text: string) => [text.length]);
    const cached = createVectorCache(embedOne, 2);
    expect(await cached("fruity")).toEqual([6]);
    expect(await cached("fruity")).toEqual([6]);
    expect(embedOne).toHaveBeenCalledTimes(1);
    await cached("nutty");
    await cached("smoky");
    await cached("fruity");
    expect(embedOne).toHaveBeenCalledTimes(4);
  });

  it("forgets a failed attempt so the next search can try again", async () => {
    const embedOne = vi.fn().mockRejectedValueOnce(new Error("busy")).mockResolvedValue([1]);
    const cached = createVectorCache(embedOne, 5);
    await expect(cached("x")).rejects.toThrow("busy");
    expect(await cached("x")).toEqual([1]);
  });
});
