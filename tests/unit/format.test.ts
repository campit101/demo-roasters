import { describe, expect, it } from "vitest";
import { cardLine, formatPounds, formatPrice, listJoin } from "@/lib/format";

describe("format", () => {
  it("shows pence as pounds", () => {
    expect(formatPrice(1150)).toBe("£11.50");
    expect(formatPrice(450)).toBe("£4.50");
    expect(formatPrice(2995)).toBe("£29.95");
    expect(formatPrice(100000)).toBe("£1,000.00");
  });

  it("joins lists the British way, without an Oxford comma", () => {
    expect(listJoin(["Brazil"])).toBe("Brazil");
    expect(listJoin(["Brazil", "Colombia"])).toBe("Brazil and Colombia");
    expect(listJoin(["Brazil", "Colombia", "Honduras"])).toBe("Brazil, Colombia and Honduras");
  });

  it("writes the small line above a product name", () => {
    const base = { size: "250 g", caffeine: "regular" as const, roast: "light" as const };
    expect(cardLine({ ...base, category: "beans", origins: ["Kenya"] })).toBe("Kenya · Light roast");
    expect(cardLine({ ...base, category: "beans", origins: ["Brazil", "India"], roast: "dark" })).toBe("Blend · Dark roast");
    expect(cardLine({ ...base, category: "beans", origins: ["Mexico"], caffeine: "decaf", roast: "dark" })).toBe("Mexico · Dark roast · Decaf");
    expect(cardLine({ category: "gear", origins: [], size: "1 litre", caffeine: null, roast: null })).toBe("Brewing gear · 1 litre");
    expect(cardLine({ category: "bundle", origins: ["Brazil"], size: "3 items", caffeine: "regular", roast: "medium" })).toBe("Gift set · 3 items");
  });

  it("drops pence only for whole-pound amounts", () => {
    expect(formatPounds(3000)).toBe("£30");
    expect(formatPounds(395)).toBe("£3.95");
  });
});
