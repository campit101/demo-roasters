import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/data/products";
import { applyFilters, isFiltered, readFilters } from "@/lib/shop-filters";
import { tastesOf } from "@/lib/taste";

const beans = PRODUCTS.filter((p) => p.category === "beans");

describe("readFilters", () => {
  it("reads known values from the page address", () => {
    expect(readFilters({ roast: "light", taste: "fruity", decaf: "1", method: "espresso", origin: "Kenya", stock: "1", sort: "price-low" })).toEqual({
      roast: "light",
      taste: "fruity",
      decaf: true,
      method: "espresso",
      origin: "Kenya",
      inStock: true,
      sort: "price-low",
    });
  });

  it("ignores tampered or unknown values", () => {
    expect(readFilters({ roast: "burnt", taste: "salty", method: "<script>", origin: "Atlantis", sort: "random", decaf: "yes" })).toEqual({
      roast: undefined,
      taste: undefined,
      decaf: undefined,
      method: undefined,
      origin: undefined,
      inStock: undefined,
      sort: "featured",
    });
  });
});

describe("applyFilters", () => {
  it("filters exactly and keeps out-of-stock products unless asked to hide them", () => {
    const decaf = applyFilters(beans, readFilters({ decaf: "1" }));
    expect(decaf.every((p) => p.caffeine === "decaf")).toBe(true);
    expect(decaf.some((p) => p.stock === 0)).toBe(true);
    expect(applyFilters(beans, readFilters({ decaf: "1", stock: "1" })).every((p) => p.stock > 0)).toBe(true);
  });

  it("puts in-stock products first by default and sorts by price on request", () => {
    const featured = applyFilters(beans, readFilters({}));
    const firstOut = featured.findIndex((p) => p.stock === 0);
    expect(featured.slice(firstOut).every((p) => p.stock === 0)).toBe(true);
    const low = applyFilters(beans, readFilters({ sort: "price-low" })).map((p) => p.pricePence);
    expect(low).toEqual([...low].sort((a, b) => a - b));
  });
});

describe("taste filter", () => {
  it("keeps only coffees with that taste and counts as a filter", () => {
    const f = readFilters({ taste: "nutty" });
    const nutty = applyFilters(beans, f);
    expect(nutty.length).toBeGreaterThan(0);
    expect(nutty.every((p) => tastesOf(p).includes("nutty"))).toBe(true);
    expect(isFiltered(f)).toBe(true);
  });
});
