// The one coffee pack (DESIGN.md, round 3), used by the photo prompts so every coffee's photo matches:
// a matte warm-white stand-up pouch printed in black with a bold sans-serif, and a small dot in the roast colour.
import type { Roast } from "@/data/products";

export const PACK = { hex: "#f2efe9", name: "matte warm-white", ink: "#161311" } as const;

/** Roast dot on the pack: name for photo prompts, hex for reference. */
export function roastDot(roast: Roast | null): { name: string; hex: string } {
  switch (roast) {
    case "light":
      return { name: "golden tan", hex: "#d9a066" };
    case "medium":
      return { name: "copper brown", hex: "#a86a3d" };
    case "medium-dark":
      return { name: "chestnut brown", hex: "#7a4528" };
    case "dark":
      return { name: "near-black espresso brown", hex: "#3a2116" };
    default:
      return { name: "copper brown", hex: "#a86a3d" };
  }
}
