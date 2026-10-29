import { describe, expect, it } from "vitest";
import { editDistance, parseQuery } from "@/search/parse";

describe("editDistance (spelling distance, swaps count as one)", () => {
  it.each([
    ["espresso", "espresso", 0],
    ["expresso", "espresso", 1],
    ["espreso", "espresso", 1],
    ["ethiopain", "ethiopian", 1],
    ["decafe", "decaf", 1],
    ["cafatiere", "cafetiere", 1],
    ["grindr", "grinder", 1],
    ["kitten", "sitting", 3],
  ])("%s → %s is %i", (a, b, d) => {
    expect(editDistance(a, b)).toBe(d);
  });
});

describe("parseQuery: prices", () => {
  it.each([
    ["decaf under £12", { maxPricePence: 1200 }],
    ["under 12", { maxPricePence: 1200 }],
    ["less than 12", { maxPricePence: 1200 }],
    ["below £9.50", { maxPricePence: 950 }],
    ["under 10 quid", { maxPricePence: 1000 }],
    ["under ten pounds", { maxPricePence: 1000 }],
    ["max £11", { maxPricePence: 1100 }],
    ["up to £20", { maxPricePence: 2000 }],
    ["£15 or less", { maxPricePence: 1500 }],
    ["£10 to £15", { minPricePence: 1000, maxPricePence: 1500 }],
    ["between 10 and 15 pounds", { minPricePence: 1000, maxPricePence: 1500 }],
    ["over £20", { minPricePence: 2000 }],
    ["more than 25 quid", { minPricePence: 2500 }],
  ])("%s", (query, expected) => {
    const { filters } = parseQuery(query);
    expect({ minPricePence: filters.minPricePence, maxPricePence: filters.maxPricePence }).toEqual({
      minPricePence: undefined,
      maxPricePence: undefined,
      ...expected,
    });
  });

  it("does not read pack sizes or cup counts as prices", () => {
    expect(parseQuery("1 kg bag").filters.maxPricePence).toBeUndefined();
    expect(parseQuery("6 cup moka pot").filters.maxPricePence).toBeUndefined();
  });

  it("swaps a back-to-front range", () => {
    expect(parseQuery("£15 to £10").filters).toMatchObject({ minPricePence: 1000, maxPricePence: 1500 });
  });
});

describe("parseQuery: filters, synonyms and typos", () => {
  it("reads decaf and its misspellings and synonyms", () => {
    for (const q of ["decaf", "decafe", "decaffeinated coffee", "caffeine free", "no caffeine please"]) {
      expect(parseQuery(q).filters.caffeine, q).toEqual(["decaf"]);
    }
  });

  it("reads brewing methods from synonyms and typos", () => {
    expect(parseQuery("expresso").filters.methods).toEqual(["espresso"]);
    expect(parseQuery("decaf espreso").filters.methods).toEqual(["espresso"]);
    expect(parseQuery("french press").filters.methods).toEqual(["cafetiere"]);
    expect(parseQuery("dark roast for cafatiere").filters.methods).toEqual(["cafetiere"]);
    expect(parseQuery("beans for my stovetop").filters.methods).toEqual(["moka-pot"]);
    expect(parseQuery("pour ovr").filters.methods).toEqual(["pour-over"]);
    expect(parseQuery("fruity light roast for filter").filters.methods).toEqual(["pour-over", "batch-brew"]);
    expect(parseQuery("coffee for a filter machine").filters.methods).toEqual(["batch-brew"]);
  });

  it("reads roasts, but keeps 'dark chocolate' as a flavour", () => {
    expect(parseQuery("dark roast").filters.roasts).toEqual(["dark"]);
    expect(parseQuery("medium dark").filters.roasts).toEqual(["medium-dark"]);
    const choc = parseQuery("dark chocolate notes");
    expect(choc.filters.roasts).toBeUndefined();
    expect(choc.terms).toContain("dark chocolate");
  });

  it("reads origins from countries, adjectives and typos", () => {
    expect(parseQuery("kenyan coffee").filters.origins).toEqual(["Kenya"]);
    expect(parseQuery("ethiopain light roast").filters).toMatchObject({ origins: ["Ethiopia"], roasts: ["light"] });
    expect(parseQuery("beans from costa rica").filters.origins).toEqual(["Costa Rica"]);
  });

  it("reads a category only when the shopper names one", () => {
    expect(parseQuery("chocolatey espresso beans").filters.categories).toEqual(["beans"]);
    expect(parseQuery("brewing equipment").filters.categories).toEqual(["gear"]);
    expect(parseQuery("gift for someone who loves espresso").filters.categories).toBeUndefined();
  });

  it("keeps the meaning words, without filler words", () => {
    expect(parseQuery("something floral and delicate").terms).toEqual(["floral", "delicate"]);
    expect(parseQuery("fruity light roast for filter").terms).toEqual(["fruity"]);
    expect(parseQuery("pour ovr starter kit").terms).toEqual(["starter", "kit"]);
  });

  it("corrects misspelt meaning words against the catalogue's own words", () => {
    const grinder = parseQuery("coffee grindr");
    expect(grinder.terms).toEqual(["grinder"]);
    expect(grinder.corrections).toContainEqual({ from: "grindr", to: "grinder" });
  });

  it("reads 'not bitter' as something to avoid, not something wanted", () => {
    const q = parseQuery("smooth and not bitter");
    expect(q.terms).toEqual(["smooth"]);
    expect(q.avoid).toEqual(["bitter"]);
    expect(parseQuery("without smoke").avoid).toEqual(["smoke"]);
    expect(parseQuery("no caffeine").avoid).toEqual([]);
  });

  it("drops a misspelt filler word instead of searching for it", () => {
    expect(parseQuery("coffe scale").terms).toEqual(["scale"]);
  });

  it("never corrects a real word into a filter", () => {
    expect(parseQuery("night shift").filters.roasts).toBeUndefined();
    expect(parseQuery("bold and smoky").filters).toEqual({});
  });

  it("returns nothing understood for an empty or nonsense query", () => {
    expect(parseQuery("")).toMatchObject({ filters: {}, terms: [], chips: [] });
    expect(parseQuery("   !!! ").terms).toEqual([]);
  });

  it("limits very long input", () => {
    expect(parseQuery("decaf ".repeat(500)).raw.length).toBeLessThanOrEqual(200);
  });
});

describe("parseQuery: chips the shopper can see and remove", () => {
  it("labels every understood filter in plain English", () => {
    const { chips } = parseQuery("decafe espresso under £12");
    expect(chips.map((c) => c.label)).toEqual(["Decaf", "Espresso", "Under £12.00"]);
  });

  it("labels ranges, origins, roasts and categories", () => {
    expect(parseQuery("ethiopian light roast beans £10 to £15").chips.map((c) => c.label)).toEqual([
      "Light roast",
      "From Ethiopia",
      "Beans",
      "£10.00 to £15.00",
    ]);
  });
});
