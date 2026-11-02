import { describe, expect, it } from "vitest";
import { DELIVERY, LIMITS } from "@/config/shop";
import { addLine, basketTotals, EMPTY, lineKey, parseBasket, removeLine, roomFor, setQuantity, type BasketItem } from "@/lib/basket";

const beans: BasketItem = { slug: "hillside-sunrise", name: "Hillside Sunrise", pricePence: 1150, grind: "filter" };
const kettle: BasketItem = { slug: "gooseneck-kettle", name: "Stovetop Gooseneck Kettle", pricePence: 3400, grind: null };

describe("basket", () => {
  it("adds a line, and adds to the same line for the same product and grind", () => {
    let b = addLine(EMPTY, beans, 1);
    b = addLine(b, beans, 1);
    expect(b.lines).toHaveLength(1);
    expect(b.lines[0]!.quantity).toBe(2);
  });

  it("keeps the same coffee in different grinds as separate lines", () => {
    const b = addLine(addLine(EMPTY, beans, 1), { ...beans, grind: "espresso" }, 1);
    expect(b.lines.map((l) => l.grind)).toEqual(["filter", "espresso"]);
    expect(lineKey(b.lines[0]!)).not.toBe(lineKey(b.lines[1]!));
  });

  it("never goes above the per-line cap or below one", () => {
    const b = addLine(EMPTY, beans, 99);
    expect(b.lines[0]!.quantity).toBe(LIMITS.maxQuantityPerLine);
    const key = lineKey(b.lines[0]!);
    expect(setQuantity(b, key, 0).lines[0]!.quantity).toBe(1);
    expect(setQuantity(b, key, 50).lines[0]!.quantity).toBe(LIMITS.maxQuantityPerLine);
  });

  it("removes a line", () => {
    const b = addLine(addLine(EMPTY, beans, 1), kettle, 1);
    expect(removeLine(b, lineKey(b.lines[0]!)).lines.map((l) => l.slug)).toEqual(["gooseneck-kettle"]);
  });

  it("charges delivery below the free threshold and none from it", () => {
    const small = basketTotals(addLine(EMPTY, beans, 1));
    expect(small).toMatchObject({ itemCount: 1, subtotalPence: 1150, deliveryPence: DELIVERY.flatPence, totalPence: 1150 + DELIVERY.flatPence });
    expect(small.toFreeDeliveryPence).toBe(DELIVERY.freeFromPence - 1150);
    const big = basketTotals(addLine(addLine(EMPTY, kettle, 1), beans, 1));
    expect(big.subtotalPence).toBeGreaterThanOrEqual(DELIVERY.freeFromPence);
    expect(big).toMatchObject({ deliveryPence: 0, toFreeDeliveryPence: 0, totalPence: big.subtotalPence });
  });

  it("charges nothing for an empty basket", () => {
    expect(basketTotals(EMPTY)).toMatchObject({ itemCount: 0, subtotalPence: 0, deliveryPence: 0, totalPence: 0 });
  });

  it("reads a saved basket safely, dropping anything malformed or tampered", () => {
    expect(parseBasket(null)).toEqual(EMPTY);
    expect(parseBasket("not json")).toEqual(EMPTY);
    const saved = JSON.stringify({
      lines: [
        { slug: "hillside-sunrise", name: "Hillside Sunrise", pricePence: 1150, grind: "filter", quantity: 2 },
        { slug: "x", name: "Free", pricePence: -500, grind: null, quantity: 1 },
        { slug: "y", name: "Bad grind", pricePence: 100, grind: "dust", quantity: 1 },
        { slug: "z", name: "Too many", pricePence: 100, grind: null, quantity: 40 },
      ],
    });
    const b = parseBasket(saved);
    expect(b.lines.map((l) => l.slug)).toEqual(["hillside-sunrise", "z"]);
    expect(b.lines[1]!.quantity).toBe(LIMITS.maxQuantityPerLine);
  });

  it("keeps one coffee to 3 units across its grinds, and the basket to 6 units, as checkout does", () => {
    let b = addLine(EMPTY, beans, 2);
    b = addLine(b, { ...beans, grind: "espresso" }, 3);
    expect(b.lines.map((l) => l.quantity)).toEqual([2, 1]);
    const espresso = lineKey(b.lines[1]!);
    expect(setQuantity(b, espresso, 3).lines[1]!.quantity).toBe(1);
    let full = addLine(EMPTY, kettle, 3);
    full = addLine(full, beans, 3);
    expect(basketTotals(full).itemCount).toBe(LIMITS.maxUnitsPerCheckout);
    expect(addLine(full, { ...beans, slug: "honey-valley", name: "Honey Valley" }, 1).lines).toHaveLength(2);
  });

  it("says how many more of a line it can take", () => {
    const b = addLine(addLine(EMPTY, beans, 2), kettle, 3);
    expect(roomFor(b, { ...beans, grind: "espresso" })).toBe(1);
    expect(roomFor(b, { ...beans, slug: "honey-valley" })).toBe(1);
  });
});
