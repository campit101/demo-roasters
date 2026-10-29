import { describe, expect, it } from "vitest";
import { BREW_METHODS, PRODUCTS, ROASTS, type Product } from "@/data/products";

const beans = PRODUCTS.filter((p) => p.category === "beans");
const gear = PRODUCTS.filter((p) => p.category === "gear");
const bundles = PRODUCTS.filter((p) => p.category === "bundle");

function allText(p: Product): string {
  return [p.name, p.description, p.size, ...p.flavourNotes, ...p.origins].join(" ");
}

describe("catalogue shape", () => {
  it("has 40 products: 24 beans, 10 gear, 6 bundles", () => {
    expect(PRODUCTS).toHaveLength(40);
    expect(beans).toHaveLength(24);
    expect(gear).toHaveLength(10);
    expect(bundles).toHaveLength(6);
  });

  it("uses unique, URL-safe slugs and unique names", () => {
    const slugs = PRODUCTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(PRODUCTS.map((p) => p.name)).size).toBe(PRODUCTS.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("prices every product in whole pence between £3 and £50", () => {
    for (const p of PRODUCTS) {
      expect(Number.isInteger(p.pricePence), p.slug).toBe(true);
      expect(p.pricePence, p.slug).toBeGreaterThanOrEqual(300);
      expect(p.pricePence, p.slug).toBeLessThanOrEqual(5000);
    }
  });

  it("keeps stock a whole number of zero or more, with some products out of stock", () => {
    for (const p of PRODUCTS) expect(Number.isInteger(p.stock) && p.stock >= 0, p.slug).toBe(true);
    expect(beans.filter((p) => p.stock === 0).length).toBeGreaterThanOrEqual(3);
    expect(beans.some((p) => p.stock === 0 && p.caffeine === "decaf")).toBe(true);
    expect(gear.some((p) => p.stock === 0)).toBe(true);
  });

  it("gives every bean a roast, caffeine, origin, flavour notes and brew methods", () => {
    for (const p of beans) {
      expect(ROASTS, p.slug).toContain(p.roast);
      expect(["regular", "decaf"], p.slug).toContain(p.caffeine);
      expect(p.origins.length, p.slug).toBeGreaterThan(0);
      expect(p.flavourNotes.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.brewMethods.length, p.slug).toBeGreaterThan(0);
    }
  });

  it("gives gear no roast, caffeine, origin or flavour notes", () => {
    for (const p of gear) {
      expect(p.roast, p.slug).toBeNull();
      expect(p.caffeine, p.slug).toBeNull();
      expect(p.origins, p.slug).toEqual([]);
      expect(p.flavourNotes, p.slug).toEqual([]);
      expect(p.brewMethods.length, p.slug).toBeGreaterThan(0);
    }
  });

  it("uses only known brew methods", () => {
    for (const p of PRODUCTS) for (const m of p.brewMethods) expect(BREW_METHODS, p.slug).toContain(m);
  });

  it("has enough decaf for real choice, at prices either side of £12", () => {
    const decafBeans = beans.filter((p) => p.caffeine === "decaf");
    expect(decafBeans.length).toBeGreaterThanOrEqual(5);
    expect(decafBeans.some((p) => p.pricePence < 1200 && p.stock > 0)).toBe(true);
    expect(decafBeans.some((p) => p.pricePence > 1200 && p.stock > 0)).toBe(true);
  });
});

describe("catalogue copy", () => {
  it("never names a real coffee brand or trademarked brewer", () => {
    const banned = /\b(starbucks|nespresso|costa coffee|lavazza|illy|nescafe|nescafé|aeropress|chemex|hario|v60|bialetti|kalita|bodum|fellow|acaia|baratza|sage|delonghi|breville|kenco|douwe|pret)\b/i;
    for (const p of PRODUCTS) expect(allText(p), p.slug).not.toMatch(banned);
  });

  it("makes no reviews, ratings, awards or health claims", () => {
    const banned = /\b(review|rated|rating|stars?|award|bestsell|best-sell|customers love|healthy|health|antioxidant|boosts?|cure|detox)\b/i;
    for (const p of PRODUCTS) expect(allText(p), p.slug).not.toMatch(banned);
  });

  it("uses British spelling, metric sizes and no em dashes", () => {
    const american = /\b(flavor|color|favorite|center|liter|gray|ounce|oz)\b/i;
    for (const p of PRODUCTS) {
      expect(allText(p), p.slug).not.toMatch(american);
      expect(allText(p), p.slug).not.toContain(String.fromCharCode(0x2014)); // em dash
    }
  });

  it("writes a real description for every product", () => {
    for (const p of PRODUCTS) {
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(80);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(400);
    }
  });
});
