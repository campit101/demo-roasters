import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/data/products";
import { backdropOf, DARK_CHOCOLATE, TASTES, tasteById, tasteOf, tastesOf } from "@/lib/taste";

const beans = PRODUCTS.filter((p) => p.category === "beans");

describe("tastes", () => {
  it("reads a coffee's main taste from its first flavour note", () => {
    const blueberry = beans.find((p) => p.flavourNotes[0] === "blueberry")!;
    expect(tasteOf(blueberry)).toBe("fruity");
    const choc = beans.find((p) => p.flavourNotes[0] === "milk chocolate")!;
    expect(tasteOf(choc)).toBe("chocolatey");
  });

  it("gives every coffee a main taste, and every taste at least one coffee", () => {
    for (const p of beans) expect(TASTES.map((t) => t.id)).toContain(tasteOf(p));
    for (const t of TASTES) expect(beans.some((p) => tastesOf(p).includes(t.id))).toBe(true);
  });

  it("lists every taste a coffee has, main taste first, without repeats", () => {
    for (const p of beans) {
      const all = tastesOf(p);
      expect(all[0]).toBe(tasteOf(p));
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("has no taste for gear", () => {
    const kettle = PRODUCTS.find((p) => p.slug === "gooseneck-kettle")!;
    expect(tasteOf(kettle)).toBeNull();
    expect(tastesOf(kettle)).toEqual([]);
  });

  it("gives each taste its own card colour", () => {
    expect(new Set(TASTES.map((t) => t.colour)).size).toBe(TASTES.length);
    for (const t of TASTES) expect(t.colour).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("gives dark-chocolate coffees a deeper shade than milk-chocolate ones", () => {
    const dark = beans.find((p) => p.flavourNotes[0] === "dark chocolate")!;
    const milk = beans.find((p) => p.flavourNotes[0] === "milk chocolate")!;
    expect(backdropOf(dark)).toEqual(DARK_CHOCOLATE);
    expect(backdropOf(milk).colour).toBe(tasteById("chocolatey").colour);
  });
});
