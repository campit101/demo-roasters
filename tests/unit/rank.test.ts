import { describe, expect, it } from "vitest";
import { PRODUCTS, type Product } from "@/data/products";
import { parseQuery } from "@/search/parse";
import { matchesFilters, rankProducts } from "@/search/rank";

const search = (q: string, semantic?: Map<string, number>) => rankProducts(PRODUCTS, parseQuery(q), { semantic }).map((r) => r.product);
const slugs = (q: string) => search(q).map((p) => p.slug);

const product = (overrides: Partial<Product>): Product => ({
  slug: "x",
  name: "X",
  category: "beans",
  description: "",
  size: "250 g",
  pricePence: 1000,
  roast: "medium",
  caffeine: "regular",
  origins: ["Brazil"],
  flavourNotes: [],
  brewMethods: ["espresso"],
  stock: 5,
  art: "bag",
  ...overrides,
});

describe("hard rules (never broken, whatever the ranking)", () => {
  it("never shows an out-of-stock product, even the perfect match", () => {
    for (const q of ["thousand hills", "hush decaf", "highland mist", "moka pot", "", "coffee"]) {
      for (const p of search(q)) expect(p.stock, `${q}: ${p.slug}`).toBeGreaterThan(0);
    }
  });

  it("never shows anything over a stated price or under a stated floor", () => {
    for (const p of search("anything under £12")) expect(p.pricePence).toBeLessThanOrEqual(1200);
    for (const p of search("over £25")) expect(p.pricePence).toBeGreaterThanOrEqual(2500);
    for (const p of search("£10 to £11")) expect(p.pricePence >= 1000 && p.pricePence <= 1100).toBe(true);
  });

  it("applies every understood filter exactly", () => {
    for (const p of search("decaf")) expect(p.caffeine).toBe("decaf");
    for (const p of search("light roast")) expect(p.roast).toBe("light");
    for (const p of search("kenyan")) expect(p.origins).toContain("Kenya");
    for (const p of search("french press")) expect(p.brewMethods).toContain("cafetiere");
    for (const p of search("brewing gear")) expect(p.category).toBe("gear");
  });

  it("leaves out products with no value for a filtered attribute (gear has no roast or caffeine)", () => {
    const gear = product({ category: "gear", roast: null, caffeine: null, origins: [] });
    expect(matchesFilters(gear, { caffeine: ["decaf"] })).toBe(false);
    expect(matchesFilters(gear, { roasts: ["dark"] })).toBe(false);
    expect(matchesFilters(gear, { origins: ["Brazil"] })).toBe(false);
    expect(matchesFilters(gear, {})).toBe(true);
  });

  it("returns only real catalogue products, each once", () => {
    const results = slugs("chocolate");
    expect(new Set(results).size).toBe(results.length);
    const known = new Set(PRODUCTS.map((p) => p.slug));
    for (const s of results) expect(known.has(s)).toBe(true);
  });
});

describe("ordering", () => {
  it("puts flavour matches first for a flavour word, including its family (chocolatey → cocoa)", () => {
    const top = search("chocolatey").slice(0, 5);
    for (const p of top) expect(p.flavourNotes.join(" ")).toMatch(/chocolate|cocoa|cacao/);
  });

  it("drops products that match neither a word nor its meaning when the query has meaning words", () => {
    for (const p of search("nutty")) expect(`${p.name} ${p.description} ${p.flavourNotes.join(" ")}`).toMatch(/nut|almond|hazelnut|peanut|walnut/i);
  });

  it("ranks a name match above a description-only match", () => {
    const named = product({ slug: "named", name: "Smoky Mountain", description: "plain" });
    const described = product({ slug: "described", name: "Plain", description: "a smoky cup" });
    const ranked = rankProducts([described, named], parseQuery("smoky"), {}).map((r) => r.product.slug);
    expect(ranked).toEqual(["named", "described"]);
  });

  it("with only filters, prefers products made for that method", () => {
    const allRounder = product({ slug: "all-rounder", brewMethods: ["cafetiere", "pour-over", "cold-brew"] });
    const specialist = product({ slug: "specialist", brewMethods: ["cold-brew"] });
    expect(rankProducts([allRounder, specialist], parseQuery("cold brew"), {}).map((r) => r.product.slug)).toEqual([
      "specialist",
      "all-rounder",
    ]);
  });

  it("lets meaning scores from the embedding model reorder close keyword matches", () => {
    const a = product({ slug: "a", description: "gentle" });
    const b = product({ slug: "b", description: "gentle" });
    const semantic = new Map([
      ["a", 0.2],
      ["b", 0.9],
    ]);
    expect(rankProducts([a, b], parseQuery("gentle"), { semantic }).map((r) => r.product.slug)).toEqual(["b", "a"]);
  });

  it("pushes down products with a word the shopper wants to avoid", () => {
    const bitter = product({ slug: "bitter", description: "smooth but bittersweet" });
    const smooth = product({ slug: "smooth", description: "smooth and sweet" });
    expect(rankProducts([bitter, smooth], parseQuery("smooth and not bitter"), {}).map((r) => r.product.slug)).toEqual([
      "smooth",
    ]);
  });

  it("puts single-origin coffees first for an origin search", () => {
    const blend = product({ slug: "blend", origins: ["Brazil", "Guatemala"] });
    const single = product({ slug: "single", origins: ["Guatemala"], pricePence: 1500 });
    expect(rankProducts([blend, single], parseQuery("guatemalan"), {}).map((r) => r.product.slug)).toEqual(["single", "blend"]);
  });

  it("does not treat a short word as a match for a much longer one (small is not smallholding)", () => {
    const holding = product({ slug: "holding", description: "from a smallholding" });
    const [result] = rankProducts([holding], parseQuery("small"), {});
    expect(result?.keyword).toBe(0);
    expect(result?.loose).toBe(true); // nothing matched the words, so it is shown only as a filter-only fallback
  });

  it("leaves out weak matches far below the best one", () => {
    const strong = product({ slug: "strong", name: "Floral Jasmine Bergamot", flavourNotes: ["jasmine", "bergamot"], description: "floral" });
    const weak = product({ slug: "weak", description: "a hint of something floral" });
    expect(rankProducts([strong, weak], parseQuery("floral jasmine bergamot"), {}).map((r) => r.product.slug)).toEqual(["strong"]);
  });

  it("judges meaning scores relative to this search, so a tight cluster of similar scores adds nothing", () => {
    const a = product({ slug: "a", description: "gentle" });
    const unrelated = product({ slug: "unrelated", description: "plain" });
    // The model rates everything fairly alike (0.84 vs 0.83): the unrelated product must not sneak in.
    const semantic = new Map([
      ["a", 0.84],
      ["unrelated", 0.83],
    ]);
    expect(rankProducts([a, unrelated], parseQuery("gentle"), { semantic }).map((r) => r.product.slug)).toEqual(["a"]);
  });

  it("lets a clear meaning match in without sharing a word", () => {
    const words = product({ slug: "words", description: "gentle" });
    const meaning = product({ slug: "meaning", description: "soothing" });
    const far = product({ slug: "far", description: "plain" });
    const semantic = new Map([
      ["words", 0.8],
      ["meaning", 0.95],
      ["far", 0.7],
    ]);
    expect(rankProducts([words, meaning, far], parseQuery("gentle"), { semantic }).map((r) => r.product.slug)).toContain("meaning");
  });

  it("is deterministic", () => {
    expect(slugs("espresso")).toEqual(slugs("espresso"));
  });

  it("caps the number of results", () => {
    expect(search("").length).toBeLessThanOrEqual(24);
  });
});
