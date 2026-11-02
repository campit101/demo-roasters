import { describe, expect, it } from "vitest";
import { BREW_METHODS, CATEGORIES, ORIGINS, ROASTS } from "@/data/products";
import { FLAVOUR_PHRASES, VOCABULARY } from "@/search/vocabulary";

const allowed: Record<string, readonly string[]> = {
  caffeine: ["regular", "decaf"],
  roast: ROASTS,
  origin: ORIGINS,
  method: BREW_METHODS,
  category: CATEGORIES,
};

describe("vocabulary", () => {
  it("maps every phrase only to values that exist in the catalogue's own lists", () => {
    for (const entry of VOCABULARY) {
      expect(entry.values.length, entry.phrase).toBeGreaterThan(0);
      for (const value of entry.values) expect(allowed[entry.kind], entry.phrase).toContain(value);
    }
  });

  it("uses lower-case, unique phrases", () => {
    const phrases = VOCABULARY.map((e) => e.phrase);
    expect(new Set(phrases).size).toBe(phrases.length);
    for (const p of phrases) expect(p).toBe(p.toLowerCase());
  });

  it("knows every origin country by name and by its adjective", () => {
    const phrases = new Set(VOCABULARY.filter((e) => e.kind === "origin").map((e) => e.phrase));
    for (const origin of ORIGINS) expect(phrases.has(origin.toLowerCase()), origin).toBe(true);
    for (const adjective of ["ethiopian", "kenyan", "colombian", "brazilian", "guatemalan", "peruvian", "mexican"]) {
      expect(phrases.has(adjective), adjective).toBe(true);
    }
  });

  it("knows the synonyms shoppers use", () => {
    const lookup = (phrase: string) => VOCABULARY.find((e) => e.phrase === phrase);
    expect(lookup("french press")?.values).toEqual(["cafetiere"]);
    expect(lookup("stovetop")?.values).toEqual(["moka-pot"]);
    expect(lookup("caffeine free")?.values).toEqual(["decaf"]);
    expect(lookup("filter")?.values).toEqual(["pour-over", "batch-brew"]);
    expect(lookup("decaffeinated")?.values).toEqual(["decaf"]);
  });

  it("treats colour words inside flavour notes as flavours, not roasts", () => {
    for (const phrase of ["dark chocolate", "milk chocolate", "brown sugar", "red apple", "black cherry"]) {
      expect(FLAVOUR_PHRASES, phrase).toContain(phrase);
    }
  });
});
