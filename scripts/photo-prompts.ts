// Builds one photo prompt per product (round 3: each product on its own taste-colour backdrop, DESIGN.md) and the
// lifestyle scenes for the home page. Coffee always comes in the one pack (src/lib/pack.ts), with each product's
// own name and facts printed on it.
import { PRODUCTS, type Product } from "../src/data/products.ts";
import { PACK, roastDot } from "../src/lib/pack.ts";
import { backdropOf } from "../src/lib/taste.ts";

const studio = (backdrop: string, hex: string) =>
  `Photorealistic studio product photograph for a modern specialty coffee shop website. One single product, centred, standing upright, photographed straight on from the front at eye level with an 85 mm lens, filling about 68 percent of the frame height. Seamless, perfectly even, flat solid ${backdrop} (exactly ${hex}) paper backdrop filling the whole frame, no gradient, no vignette, no props, no visible floor edge. Soft even diffused light from the front left, a soft natural contact shadow under the product. Crisp focus, true-to-life materials.`;

const join = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

function packPrompt(p: Product, wide = false): string {
  const origin = p.origins.length > 1 ? `${join(p.origins)} blend` : p.origins[0];
  const roast = p.roast ? `${p.roast.replace("-", " ")} roast` : "";
  const decaf = p.caffeine === "decaf" ? " Across the lower part of the pouch a solid black band with the word DECAF in white spaced capitals." : "";
  return `A ${wide ? "large wide 1 kg " : ""}${PACK.name} stand-up coffee pouch with a flat folded top and a small round one-way valve near the top. Printed directly on the front in black: at the top the small bold spaced capitals DEMO ROASTERS, below it a small solid ${roastDot(p.roast).name} circle, then the large bold modern sans-serif words ${p.name}, and below in small type ${origin}, ${roast}, ${p.size}.${decaf} No other text, logos or labels anywhere.`;
}

const GEAR: Record<string, string> = {
  "gooseneck-kettle": "A brushed stainless-steel stovetop pour-over kettle with a long thin curved gooseneck spout pointing left and a black handle on the right. No text or logos.",
  "ceramic-dripper": "A glazed terracotta ceramic cone pour-over dripper sitting on top of a clear glass coffee server with a little brewed coffee inside. No text or logos.",
  "paper-filters-100": "A plain white card sleeve of cone coffee filters with a few white cone paper filters sticking out of the top. On the sleeve in small bold black sans-serif type: Paper Filters, and below 100 filters. No other text.",
  "glass-cafetiere": "A glass French press cafetière with a polished stainless-steel frame, a black handle and a black plunger knob, half full of dark coffee. No text or logos.",
  "hand-burr-grinder": "A cylindrical brushed stainless-steel hand coffee grinder with a walnut wood band, a steel crank handle on top and a small wooden knob. No text or logos.",
  "stovetop-moka-pot": "A classic octagonal aluminium stovetop moka pot with a black handle and a black lid knob. No text or logos.",
  "cold-brew-jar": "A tall glass cold brew jar with a black lid and a fine steel mesh filter insert inside, filled with dark cold brew coffee. No text or logos.",
  "digital-brew-scale": "A slim matte black digital coffee scale with a small glowing display showing 15.0 g, a plain white ceramic cup standing on it. No other text or logos.",
  "travel-press": "A charcoal-grey insulated travel coffee press, cylinder shaped, with a brushed steel band and a black cap with a plunger knob. No text or logos.",
  "espresso-tamper": "A heavy stainless-steel 58 mm espresso tamper with a rounded walnut wood handle, standing upright. No text or logos.",
};

const pouch = `${PACK.name} coffee pouch printed in black with the small spaced capitals DEMO ROASTERS`;
const BUNDLES: Record<string, string> = {
  "filter-starter-set": `A plain white gift box with a black ribbon, next to a terracotta ceramic pour-over dripper and a ${pouch}. A small white card leaning on the box reads Filter Starter Set in bold black sans-serif. No other text.`,
  "espresso-lovers-box": `A plain white gift box with a black lid and a black ribbon bow, next to a stainless-steel espresso tamper and a ${pouch}. A small white card on the box reads Espresso Lover's Box in bold black sans-serif. No other text.`,
  "decaf-discovery-trio": `Three small ${PACK.name} coffee pouches, each with a solid black band reading DECAF, standing side by side in front of a plain white gift box with a black ribbon bow. A small white card reads Decaf Discovery Trio in bold black sans-serif. No other text.`,
  "origin-tasting-flight": `Exactly four (4) small ${PACK.name} coffee pouches, no more, standing in one row in front of a plain white gift box with a black ribbon. A small white card reads Origin Tasting Flight in bold black sans-serif. No other text.`,
  "cold-brew-kit": `A tall glass cold brew jar with a black lid next to a ${pouch}, tied together with a black ribbon. A small white tag reads Cold Brew Kit in bold black sans-serif. No other text.`,
  "weekend-brunch-box": `A glass French press cafetière next to a ${pouch}, with a small white gift tag tied on with string that reads Weekend Brunch in bold black sans-serif. No other text.`,
};

export function productPrompt(p: Product): string {
  if (p.category === "gear") return GEAR[p.slug] ?? `${p.name}, a piece of coffee brewing equipment. No text or logos.`;
  if (p.category === "bundle") return BUNDLES[p.slug] ?? `A plain white gift box with a black ribbon. No text.`;
  return packPrompt(p, p.art === "big-bag");
}

// Home page scenes. No readable text except the small DEMO ROASTERS wordmark; no people's faces.
const SCENE =
  "Photorealistic editorial lifestyle photograph for a modern specialty coffee shop website, natural daylight, shallow depth of field, warm and calm, clean uncluttered composition, no readable text anywhere except where stated, no logos, no faces.";
export const LIFESTYLE: { file: string; prompt: string; width: number; height: number }[] = [
  {
    file: "hero.png",
    width: 1120,
    height: 1392,
    prompt: `${SCENE} Morning sunlight through a window onto a pale oak kitchen table: a glass pour-over server with a ceramic dripper, a white ceramic cup of black coffee, and a ${PACK.name} coffee pouch printed with the small black spaced capitals DEMO ROASTERS standing behind. Soft window shadows on a plain warm white wall.`,
  },
  {
    file: "coffee.png",
    width: 1120,
    height: 1392,
    prompt: `${SCENE} Close-up of freshly roasted whole coffee beans spilling from a ${PACK.name} coffee pouch onto a pale stone worktop, a small brass scoop full of beans in front.`,
  },
  {
    file: "gear.png",
    width: 1120,
    height: 1392,
    prompt: `${SCENE} A hand holding a brushed stainless-steel gooseneck kettle, pouring a thin stream of hot water into a ceramic pour-over dripper on a glass server, steam rising, on a pale oak counter. Only the hand and forearm are visible.`,
  },
  {
    file: "gifts.png",
    width: 1120,
    height: 1392,
    prompt: `${SCENE} A plain white gift box with a black ribbon bow, a ${PACK.name} coffee pouch and a small terracotta dripper arranged on a linen cloth on a pale wooden table, a sprig of eucalyptus beside them.`,
  },
  {
    file: "taste.png",
    width: 1120,
    height: 1392,
    prompt: `${SCENE} Top-down flat lay on a pale linen background: a white cup of black coffee in the centre, surrounded by small neat piles of the flavours found in coffee: raspberries, broken squares of dark chocolate, hazelnuts, a curl of orange peel, a few jasmine flowers and a drizzle of honey on a spoon.`,
  },
  {
    file: "brew.png",
    width: 1392,
    height: 928,
    prompt: `${SCENE} Wide shot of a calm home coffee corner on a pale oak counter: a hand coffee grinder, a digital scale with a glass server and dripper on it, a gooseneck kettle and a ${PACK.name} coffee pouch, soft morning light from the left, plenty of empty space on the right.`,
  },
];

export function jobs(): { file: string; prompt: string }[] {
  return PRODUCTS.map((p) => ({ file: `${p.slug}.png`, prompt: `${studio(backdropOf(p).colourName, backdropOf(p).colour)} ${productPrompt(p)}` }));
}

if (process.argv[1]?.endsWith("photo-prompts.ts")) {
  for (const j of jobs().slice(0, 3)) console.log(`${j.file}\n  ${j.prompt}\n`);
}
