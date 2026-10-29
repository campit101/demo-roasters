// Taste families for coffees, read from their flavour notes. A coffee's main taste (its first note) picks
// the colour block behind its photo on cards and pages (DESIGN.md, round 3), and the "Taste" filter uses all of them.
import type { Product } from "@/data/products";

export const TASTE_IDS = ["fruity", "floral", "chocolatey", "nutty", "caramel", "smoky"] as const;
export type TasteId = (typeof TASTE_IDS)[number];

export interface Taste {
  id: TasteId;
  label: string;
  /** Words in flavour notes that belong to this taste. */
  words: readonly string[];
  /** Card colour (light theme), and its name for photo prompts. */
  colour: string;
  colourName: string;
}

export const TASTES: readonly Taste[] = [
  {
    id: "fruity",
    label: "Fruity",
    words: ["berry", "blueberry", "strawberry", "blackcurrant", "cherry", "apple", "peach", "apricot", "plum", "grapefruit", "lemon", "orange", "tangerine", "lime", "wine"],
    colour: "#f3a6a0",
    colourName: "soft coral pink",
  },
  { id: "floral", label: "Floral", words: ["jasmine", "hibiscus", "bergamot", "tea"], colour: "#cdbbe6", colourName: "pale lilac" },
  { id: "chocolatey", label: "Chocolatey", words: ["chocolate", "cocoa", "cacao"], colour: "#dcb79c", colourName: "light milk-chocolate tan" },
  { id: "nutty", label: "Nutty", words: ["hazelnut", "almond", "peanut", "walnut", "nuts", "malt"], colour: "#e3c48f", colourName: "pale hazelnut gold" },
  { id: "caramel", label: "Caramel", words: ["caramel", "toffee", "honey", "sugar", "molasses", "treacle"], colour: "#f2b765", colourName: "warm caramel orange" },
  { id: "smoky", label: "Smoky", words: ["smoke", "cedar", "spice"], colour: "#a9b3ad", colourName: "smoky sage grey" },
];

/** Chocolatey coffees whose first note is dark chocolate, cocoa or cacao get a deeper shade, so the grid varies. */
export const DARK_CHOCOLATE = { colour: "#b98a6c", colourName: "medium cocoa tan" } as const;
const DARK_CHOCOLATE_WORDS = ["dark", "bittersweet", "cocoa", "cacao"];

/** Colour blocks for products without a taste. */
export const GEAR_COLOUR = { colour: "#dedbd2", colourName: "pale stone grey" } as const;
export const GIFT_COLOUR = { colour: "#b8d1c2", colourName: "soft sage green" } as const;

const tasteOfNote = (note: string): TasteId | null => {
  const words = note.toLowerCase().split(/[\s-]+/);
  return TASTES.find((t) => t.words.some((w) => words.includes(w)))?.id ?? null;
};

/** Every taste a coffee has, main taste first. Gear and gift sets have none. */
export function tastesOf(p: Pick<Product, "category" | "flavourNotes">): TasteId[] {
  if (p.category !== "beans") return [];
  const found = p.flavourNotes.map(tasteOfNote).filter((t): t is TasteId => t !== null);
  return [...new Set(found)];
}

export const tasteOf = (p: Pick<Product, "category" | "flavourNotes">): TasteId | null => tastesOf(p)[0] ?? null;

export const tasteById = (id: TasteId) => TASTES.find((t) => t.id === id)!;

/** The colour block behind a product: its main taste, or stone for gear and sage for gift sets. */
export function backdropOf(p: Pick<Product, "category" | "flavourNotes">): { colour: string; colourName: string } {
  const t = tasteOf(p);
  if (t === "chocolatey" && DARK_CHOCOLATE_WORDS.some((w) => (p.flavourNotes[0] ?? "").toLowerCase().includes(w))) return DARK_CHOCOLATE;
  if (t) return tasteById(t);
  return p.category === "bundle" ? GIFT_COLOUR : GEAR_COLOUR;
}
