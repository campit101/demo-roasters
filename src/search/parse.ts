// Turns a shopper's plain-English query into exact filters (price, caffeine, roast, origin, method,
// category) plus the leftover meaning words. Pure and deterministic: no network, no AI, no database.
import {
  PRODUCTS,
  type BrewMethod,
  type Caffeine,
  type Category,
  type Origin,
  type Roast,
} from "@/data/products";
import { FLAVOUR_PHRASES, VOCABULARY, type FilterKind, type VocabEntry } from "./vocabulary";

export const MAX_QUERY_LENGTH = 200;

export interface Filters {
  caffeine?: Caffeine[];
  roasts?: Roast[];
  methods?: BrewMethod[];
  origins?: Origin[];
  categories?: Category[];
  minPricePence?: number;
  maxPricePence?: number;
}

export type ChipKind = FilterKind | "price";
export interface Chip {
  kind: ChipKind;
  value: string;
  label: string;
}

export interface ParsedQuery {
  raw: string;
  filters: Filters;
  terms: string[];
  /** Meaning words the shopper wants to avoid ("not bitter", "without smoke"). */
  avoid: string[];
  corrections: { from: string; to: string }[];
  chips: Chip[];
}

// ── Spelling distance ────────────────────────────────────────────────────────────────────────────

/** Optimal string alignment distance: insertions, deletions, substitutions and swapped neighbours. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, d[i - 2]![j - 2]! + 1);
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

/** How many spelling slips a word of this length may have and still count as the same word. */
function allowedSlips(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

// ── Words ────────────────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    "a an the and or but for of to in on at by with without from into my me i im we our you your some something someone " +
    "anything any who that which what this these those is are be it its please want wants need needs looking look find show " +
    "get buy like likes love loves good nice great best really very just one ones coffee coffees cup cups mug home notes " +
    "type kind sort taste tastes tasting drink drinks make makes making brew brewing brewed suit suits suitable using use " +
    "too overly so"
  ).split(" "),
);

/** Words that turn the next meaning word into something to avoid. */
const NEGATORS = new Set(["not", "no", "without", "never", "isnt", "isn't", "nothing", "non"]);

// Meaning words shoppers use that the catalogue may not spell out; known words are never "corrected".
const MEANING_WORDS =
  "fruity fruit berry berries chocolatey chocolate chocolaty nutty nuts floral flowery smooth mellow strong bold " +
  "bright sweet delicate light rich bitter sour acidic citrus juicy jammy creamy spicy earthy smoky smokey cheap " +
  "affordable budget expensive special gift present starter beginner morning evening iced cold hot strong";

const tokenise = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9£.\- ]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
    .filter(Boolean);

const LEXICON: ReadonlySet<string> = new Set(
  [
    ...PRODUCTS.flatMap((p) => [p.name, p.description, ...p.flavourNotes]),
    ...VOCABULARY.map((e) => e.phrase),
    ...FLAVOUR_PHRASES,
    MEANING_WORDS,
  ]
    .flatMap((text) => tokenise(text).flatMap((t) => [t, ...t.split("-")]))
    .filter((t) => t.length >= 3 && !/\d/.test(t)),
);

const VOCAB_BY_PHRASE = new Map(VOCABULARY.map((e) => [e.phrase, e]));
const FLAVOURS = new Set(FLAVOUR_PHRASES);
const PHRASES_BY_WORD_COUNT = new Map<number, VocabEntry[]>();
for (const e of VOCABULARY) {
  const n = e.phrase.split(" ").length;
  PHRASES_BY_WORD_COUNT.set(n, [...(PHRASES_BY_WORD_COUNT.get(n) ?? []), e]);
}

const isKnown = (word: string) => STOPWORDS.has(word) || LEXICON.has(word) || /^\d/.test(word);

/** The vocabulary entry a misspelt phrase most likely means, or undefined if none is close enough. */
function fuzzyVocab(phrase: string, wordCount: number): VocabEntry | undefined {
  const limit = allowedSlips(phrase.replace(/ /g, "").length);
  if (limit === 0) return undefined;
  let best: { entry: VocabEntry; distance: number } | undefined;
  for (const entry of PHRASES_BY_WORD_COUNT.get(wordCount) ?? []) {
    const distance = editDistance(phrase, entry.phrase);
    if (distance <= limit && (!best || distance < best.distance)) best = { entry, distance };
  }
  return best?.entry;
}

/** True when every letter of `typed` appears in `candidate` in order (the shopper dropped letters). */
function isSubsequence(typed: string, candidate: string): boolean {
  let j = 0;
  for (const ch of candidate) if (ch === typed[j]) j++;
  return j === typed.length;
}

/** The catalogue word a misspelt meaning word most likely means. Ties go to a word containing every typed letter. */
function fuzzyLexicon(word: string): string | undefined {
  const limit = allowedSlips(word.length);
  if (limit === 0) return undefined;
  let best: { word: string; distance: number; contains: boolean } | undefined;
  for (const candidate of LEXICON) {
    if (Math.abs(candidate.length - word.length) > limit) continue;
    const distance = editDistance(word, candidate);
    if (distance > limit) continue;
    const contains = isSubsequence(word, candidate);
    if (!best || distance < best.distance || (distance === best.distance && contains && !best.contains)) {
      best = { word: candidate, distance, contains };
    }
  }
  return best?.word;
}

// ── Prices ───────────────────────────────────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};
const NUM = `(\\d+(?:\\.\\d{1,2})?|${Object.keys(NUMBER_WORDS).join("|")})`;
const UNIT = `(?:\\s*(?:quid|pounds?|gbp))`;
const toPence = (n: string) => Math.round((NUMBER_WORDS[n] ?? Number(n)) * 100);

const PRICE_PATTERNS: { re: RegExp; read: (m: RegExpExecArray) => Pick<Filters, "minPricePence" | "maxPricePence"> }[] = [
  { re: new RegExp(`between\\s+£?\\s*${NUM}${UNIT}?\\s*(?:and|to|-)\\s*£?\\s*${NUM}${UNIT}?`), read: (m) => range(m[1]!, m[2]!) },
  { re: new RegExp(`£\\s*${NUM}${UNIT}?\\s*(?:to|-)\\s*£?\\s*${NUM}${UNIT}?`), read: (m) => range(m[1]!, m[2]!) },
  { re: new RegExp(`${NUM}\\s*(?:to|-)\\s*${NUM}${UNIT}`), read: (m) => range(m[1]!, m[2]!) },
  {
    re: new RegExp(`(?:under|below|less than|cheaper than|up to|upto|max(?:imum)?|no more than|at most|within|<=?)\\s*£?\\s*${NUM}${UNIT}?`),
    read: (m) => ({ maxPricePence: toPence(m[1]!) }),
  },
  { re: new RegExp(`£\\s*${NUM}${UNIT}?\\s*(?:or less|or under|or below|or cheaper|and under|max(?:imum)?)`), read: (m) => ({ maxPricePence: toPence(m[1]!) }) },
  { re: new RegExp(`${NUM}${UNIT}\\s*(?:or less|or under|or below|or cheaper|and under|max(?:imum)?)`), read: (m) => ({ maxPricePence: toPence(m[1]!) }) },
  {
    re: new RegExp(`(?:over|above|more than|at least|min(?:imum)?|>=?)\\s*£?\\s*${NUM}${UNIT}?`),
    read: (m) => ({ minPricePence: toPence(m[1]!) }),
  },
  { re: new RegExp(`£\\s*${NUM}${UNIT}?\\s*(?:or more|plus|and up|and over|\\+)`), read: (m) => ({ minPricePence: toPence(m[1]!) }) },
];

function range(a: string, b: string) {
  const [low, high] = [toPence(a), toPence(b)].sort((x, y) => x - y);
  return { minPricePence: low, maxPricePence: high };
}

function extractPrices(text: string): { rest: string; prices: Pick<Filters, "minPricePence" | "maxPricePence"> } {
  let rest = text;
  const prices: Pick<Filters, "minPricePence" | "maxPricePence"> = {};
  for (const { re, read } of PRICE_PATTERNS) {
    const m = re.exec(rest);
    if (!m) continue;
    const found = read(m);
    if (found.minPricePence !== undefined && prices.minPricePence === undefined) prices.minPricePence = found.minPricePence;
    if (found.maxPricePence !== undefined && prices.maxPricePence === undefined) prices.maxPricePence = found.maxPricePence;
    rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
  }
  return { rest, prices };
}

// ── Labels ───────────────────────────────────────────────────────────────────────────────────────

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const LABELS: Record<FilterKind, (value: string) => string> = {
  caffeine: (v) => (v === "decaf" ? "Decaf" : "Regular"),
  roast: (v) => ({ light: "Light roast", medium: "Medium roast", "medium-dark": "Medium-dark roast", dark: "Dark roast" })[v] ?? v,
  method: (v) =>
    ({
      espresso: "Espresso",
      "pour-over": "Pour-over",
      "batch-brew": "Filter machine",
      cafetiere: "Cafetière",
      "hand-press": "Hand press",
      "moka-pot": "Moka pot",
      "cold-brew": "Cold brew",
    })[v] ?? v,
  origin: (v) => `From ${v}`,
  category: (v) => ({ beans: "Beans", gear: "Brewing gear", bundle: "Gift bundles" })[v] ?? v,
};

export function priceLabel(min?: number, max?: number): string | undefined {
  if (min !== undefined && max !== undefined) return `${pounds(min)} to ${pounds(max)}`;
  if (max !== undefined) return `Under ${pounds(max)}`;
  if (min !== undefined) return `Over ${pounds(min)}`;
  return undefined;
}

// ── Parse ────────────────────────────────────────────────────────────────────────────────────────

const KIND_ORDER: FilterKind[] = ["caffeine", "roast", "method", "origin", "category"];
const FILTER_KEY = { caffeine: "caffeine", roast: "roasts", method: "methods", origin: "origins", category: "categories" } as const;

export function parseQuery(input: string): ParsedQuery {
  const raw = input.slice(0, MAX_QUERY_LENGTH);
  const { rest, prices } = extractPrices(
    raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
  );
  const tokens = tokenise(rest).filter((t) => t !== "£" && !/^£?\d+(\.\d+)?$/.test(t));

  const found = new Map<FilterKind, Set<string>>();
  const terms: string[] = [];
  const avoid: string[] = [];
  const corrections: { from: string; to: string }[] = [];
  let negate = false;
  const keep = (word: string) => {
    (negate ? avoid : terms).push(word);
    negate = false;
  };
  const add = (entry: VocabEntry) => {
    const set = found.get(entry.kind) ?? new Set<string>();
    for (const v of entry.values) set.add(v);
    found.set(entry.kind, set);
  };

  let i = 0;
  outer: while (i < tokens.length) {
    // Exact phrases first, longest first; flavour phrases win over roast words ("dark chocolate").
    for (let n = Math.min(3, tokens.length - i); n >= 1; n--) {
      const phrase = tokens.slice(i, i + n).join(" ");
      if (n > 1 && FLAVOURS.has(phrase)) {
        keep(phrase);
        i += n;
        continue outer;
      }
      const entry = VOCAB_BY_PHRASE.get(phrase);
      if (entry) {
        add(entry);
        negate = false;
        i += n;
        continue outer;
      }
    }
    // Then misspelt phrases, only where at least one word is unknown to the shop.
    for (let n = Math.min(3, tokens.length - i); n >= 1; n--) {
      const words = tokens.slice(i, i + n);
      if (words.every(isKnown)) continue;
      const phrase = words.join(" ");
      const entry = fuzzyVocab(phrase, n);
      if (entry) {
        corrections.push({ from: phrase, to: entry.phrase });
        add(entry);
        negate = false;
        i += n;
        continue outer;
      }
    }
    // Otherwise it is a meaning word (corrected against the catalogue's words if misspelt).
    const word = tokens[i]!;
    i += 1;
    if (NEGATORS.has(word)) {
      negate = true;
      continue;
    }
    if (STOPWORDS.has(word) || word.length < 2) continue;
    if (!isKnown(word)) {
      const fixed = fuzzyLexicon(word);
      if (fixed) {
        corrections.push({ from: word, to: fixed });
        if (!STOPWORDS.has(fixed)) keep(fixed);
        continue;
      }
    }
    keep(word);
  }

  const filters: Filters = {};
  const chips: Chip[] = [];
  for (const kind of KIND_ORDER) {
    const values = found.get(kind);
    if (!values?.size) continue;
    (filters as Record<string, string[]>)[FILTER_KEY[kind]] = [...values];
    for (const value of values) chips.push({ kind, value, label: LABELS[kind](value) });
  }
  if (prices.minPricePence !== undefined) filters.minPricePence = prices.minPricePence;
  if (prices.maxPricePence !== undefined) filters.maxPricePence = prices.maxPricePence;
  const label = priceLabel(prices.minPricePence, prices.maxPricePence);
  if (label) chips.push({ kind: "price", value: `${prices.minPricePence ?? ""}-${prices.maxPricePence ?? ""}`, label });

  return { raw, filters, terms, avoid, corrections, chips };
}
