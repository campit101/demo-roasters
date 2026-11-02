// The words the search understands as exact filters. Typos are matched against this list only,
// so the parser can never invent a filter value the catalogue does not have.
import type { BrewMethod, Caffeine, Category, Origin, Roast } from "@/data/products";

export type FilterKind = "caffeine" | "roast" | "origin" | "method" | "category";

type ValuesFor<K extends FilterKind> = K extends "caffeine"
  ? Caffeine
  : K extends "roast"
    ? Roast
    : K extends "origin"
      ? Origin
      : K extends "method"
        ? BrewMethod
        : Category;

export interface VocabEntry<K extends FilterKind = FilterKind> {
  phrase: string;
  kind: K;
  values: readonly ValuesFor<K>[];
}

const entry = <K extends FilterKind>(kind: K, values: readonly ValuesFor<K>[], ...phrases: string[]) =>
  phrases.map((phrase): VocabEntry<K> => ({ phrase, kind, values }));

export const VOCABULARY: readonly VocabEntry[] = [
  // Caffeine
  ...entry("caffeine", ["decaf"], "decaf", "decaff", "decaffeinated", "caffeine free", "caffeine-free", "no caffeine", "without caffeine", "low caffeine"),
  ...entry("caffeine", ["regular"], "regular", "caffeinated", "full caffeine", "with caffeine"),

  // Roast
  ...entry("roast", ["light"], "light", "light roast", "lightly roasted", "blonde", "pale roast"),
  ...entry("roast", ["medium"], "medium", "medium roast"),
  ...entry("roast", ["medium-dark"], "medium dark", "medium-dark", "medium dark roast", "full city"),
  ...entry("roast", ["dark"], "dark", "dark roast", "darkly roasted", "french roast", "italian roast"),

  // Origin
  ...entry("origin", ["Brazil"], "brazil", "brazilian"),
  ...entry("origin", ["Colombia"], "colombia", "colombian"),
  ...entry("origin", ["Costa Rica"], "costa rica", "costa rican"),
  ...entry("origin", ["El Salvador"], "el salvador", "salvador", "salvadoran", "salvadorean"),
  ...entry("origin", ["Ethiopia"], "ethiopia", "ethiopian"),
  ...entry("origin", ["Guatemala"], "guatemala", "guatemalan"),
  ...entry("origin", ["Honduras"], "honduras", "honduran"),
  ...entry("origin", ["India"], "india", "indian"),
  ...entry("origin", ["Indonesia"], "indonesia", "indonesian", "sumatra", "sumatran"),
  ...entry("origin", ["Kenya"], "kenya", "kenyan"),
  ...entry("origin", ["Mexico"], "mexico", "mexican"),
  ...entry("origin", ["Panama"], "panama", "panamanian"),
  ...entry("origin", ["Peru"], "peru", "peruvian"),
  ...entry("origin", ["Rwanda"], "rwanda", "rwandan"),
  ...entry("origin", ["Ethiopia", "Kenya", "Rwanda"], "africa", "african", "east african"),
  ...entry("origin", ["Costa Rica", "El Salvador", "Guatemala", "Honduras", "Mexico", "Panama"], "central america", "central american"),
  ...entry("origin", ["Brazil", "Colombia", "Peru"], "south america", "south american"),
  ...entry("origin", ["India", "Indonesia"], "asia", "asian"),

  // Brewing method
  ...entry("method", ["espresso"], "espresso", "espressos", "espresso machine", "bean to cup"),
  ...entry("method", ["pour-over"], "pour over", "pour-over", "pourover", "dripper", "hand pour", "v60", "chemex"),
  ...entry("method", ["pour-over", "batch-brew"], "filter", "filter coffee"),
  ...entry("method", ["batch-brew"], "batch brew", "batch-brew", "filter machine", "drip machine", "drip", "coffee maker"),
  ...entry("method", ["cafetiere"], "cafetiere", "cafetière", "cafetieres", "french press", "plunger", "press pot"),
  ...entry("method", ["hand-press"], "hand press", "travel press", "aeropress"),
  ...entry("method", ["moka-pot"], "moka", "moka pot", "mocha pot", "stovetop", "stove top", "stovetop pot"),
  ...entry("method", ["cold-brew"], "cold brew", "cold-brew", "coldbrew", "iced coffee", "iced"),

  // Category (gift words are deliberately not here: a gift can be gear or a bundle, so it only nudges ranking)
  ...entry("category", ["beans"], "beans", "bean", "coffee beans", "whole bean", "whole beans"),
  ...entry("category", ["gear"], "gear", "equipment", "accessories", "brewing gear", "brewing equipment"),
  ...entry("category", ["bundle"], "bundle", "bundles"),
];

/** Flavour phrases containing roast or colour words. They are read as flavours before any roast word. */
export const FLAVOUR_PHRASES: readonly string[] = [
  "dark chocolate",
  "milk chocolate",
  "bittersweet chocolate",
  "brown sugar",
  "red apple",
  "red cherry",
  "black cherry",
  "black tea",
  "white peach",
  "red wine",
  "lemon zest",
  "cacao nib",
  "roasted nuts",
];
