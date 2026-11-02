import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/data/products";
import { LOCKED_QUERIES } from "../search/locked-queries";
import { RULES } from "../search/score";
import { TUNING_QUERIES } from "../search/tuning-queries";
import type { SearchCase } from "../search/types";

// Fingerprint of tests/search/locked-queries.ts as committed on 23 Oct 2026, before any ranking code existed.
// If this test fails, the locked set was edited: undo the edit. The locked set is never changed or loosened.
const LOCKED_SHA256 = "7d4e8ab490d84435e66e4afaf8d66eddd4a2738570558e72eb69df913d18a0f0";

// Fingerprint of the product catalogue (every field, as the app loads it) on 26 Oct 2026. Changing product words can
// quietly tune search towards the locked set, so a catalogue edit must be recorded in DECISIONS.md with its reason,
// and only then may this fingerprint be updated.
const CATALOGUE_SHA256 = "9ed394380539468302cf0f498029f67a27912e7ae5750889c12d38f3a24aba3c";

const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));

function checkCase(c: SearchCase) {
  expect(c.acceptable.length, c.id).toBeGreaterThan(0);
  expect(c.acceptable.length, c.id).toBeLessThanOrEqual(RULES.maxAcceptable);
  expect(new Set(c.acceptable).size, c.id).toBe(c.acceptable.length);
  for (const slug of c.acceptable) {
    const p = bySlug.get(slug);
    expect(p, `${c.id} ${slug}`).toBeDefined();
    expect(p!.stock, `${c.id} ${slug} in stock`).toBeGreaterThan(0);
    if (c.maxPricePence !== undefined) expect(p!.pricePence, `${c.id} ${slug}`).toBeLessThanOrEqual(c.maxPricePence);
    if (c.minPricePence !== undefined) expect(p!.pricePence, `${c.id} ${slug}`).toBeGreaterThanOrEqual(c.minPricePence);
  }
  if (c.mustBeFirst !== undefined) expect(c.acceptable, c.id).toContain(c.mustBeFirst);
}

describe("locked search test", () => {
  it("runs against the recorded catalogue (an edit needs a DECISIONS.md line first)", () => {
    expect(createHash("sha256").update(JSON.stringify(PRODUCTS)).digest("hex")).toBe(CATALOGUE_SHA256);
  });

  it("is byte-for-byte the set committed before any ranking code", () => {
    const text = readFileSync("tests/search/locked-queries.ts", "utf8").replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(text).digest("hex")).toBe(LOCKED_SHA256);
  });

  it("has 20 cases, at least 4 with a required number 1", () => {
    expect(LOCKED_QUERIES).toHaveLength(RULES.lockedCount);
    expect(LOCKED_QUERIES.filter((c) => c.mustBeFirst).length).toBeGreaterThanOrEqual(RULES.minMustBeFirst);
  });

  it("only accepts real, in-stock products within each written price limit", () => {
    for (const c of LOCKED_QUERIES) checkCase(c);
  });
});

describe("tuning set", () => {
  it("has 15 valid cases and shares no query with the locked set", () => {
    expect(TUNING_QUERIES).toHaveLength(15);
    for (const c of TUNING_QUERIES) checkCase(c);
    const locked = new Set(LOCKED_QUERIES.map((c) => c.query.toLowerCase()));
    for (const c of TUNING_QUERIES) expect(locked.has(c.query.toLowerCase()), c.query).toBe(false);
  });
});
