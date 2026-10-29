import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORY_PAGES } from "@/config/categories";
import { DELIVERY, GRINDS, GRIND_LABEL } from "@/config/shop";
import type { Product } from "@/data/products";
import { listCatalogue } from "@/db/catalogue";
import { formatPrice, listJoin, formatPounds } from "@/lib/format";
import { TASTES, tastesOf, type TasteId } from "@/lib/taste";

export const revalidate = 300;

// "Our favourites": four in-stock coffees with four different main tastes.
const FAVOURITES = ["hillside-sunrise", "honey-valley", "cerrado-sunset", "night-shift-espresso"];

const BREW_STEPS = [
  { title: "Weigh", text: "15 g of coffee for a 250 ml cup. A scale makes every cup the same." },
  { title: "Grind", text: "Just before you brew: coarse like sand for filter, fine like flour for espresso." },
  { title: "Bloom", text: "Wet the grounds with a splash of water just off the boil and wait 30 seconds." },
  { title: "Pour", text: "Add the rest slowly in small circles. About 3 minutes from first pour to last drop." },
];

const lifestyle = (name: string, alt: string, sizes: string, priority = false, w = 1120, h = 1392) => (
  <Image src={`/lifestyle/${name}.webp`} alt={alt} width={w} height={h} sizes={sizes} priority={priority} unoptimized className="h-full w-full object-cover" />
);

export default async function Home() {
  const catalogue = await listCatalogue();
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  const favourites = FAVOURITES.map((s) => bySlug.get(s)).filter((p): p is Product => Boolean(p));
  const count = (c: string) => catalogue.filter((p) => p.category === c).length;
  const tasteCount = (id: TasteId) => catalogue.filter((p) => tastesOf(p).includes(id)).length;
  const [coffee, gear, gifts] = CATEGORY_PAGES as [(typeof CATEGORY_PAGES)[number], (typeof CATEGORY_PAGES)[number], (typeof CATEGORY_PAGES)[number]];
  const tiles = [
    { href: `/shop/${coffee.slug}`, title: "Coffee", line: `${count("beans")} coffees, light to dark`, image: "coffee", alt: "Whole coffee beans spilling from a Demo Roasters pouch" },
    { href: `/shop/${gear.slug}`, title: "Brewing gear", line: `${count("gear")} pieces for brewing at home`, image: "gear", alt: "Hot water poured from a gooseneck kettle into a pour-over dripper" },
    { href: `/shop/${gifts.slug}`, title: "Gift sets", line: `${count("bundle")} sets ready to give`, image: "gifts", alt: "A white gift box with a black ribbon beside a coffee pouch and a dripper" },
    { href: "#tastes", title: "Shop by taste", line: "Fruity, chocolatey, nutty and more", image: "taste", alt: "A cup of coffee surrounded by raspberries, chocolate, hazelnuts, orange peel and jasmine" },
  ];

  return (
    <>
      {/* Hero: words on the left, a lifestyle photo on the right (split, like the reference shops). */}
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pt-8 sm:px-6 md:grid-cols-2 md:gap-12 md:pt-12">
        <div className="order-2 md:order-1">
          <p className="label">Specialty coffee, invented for a portfolio</p>
          <h1 className="mt-4 text-[2.6rem] sm:text-6xl lg:text-7xl">Coffee you choose by taste.</h1>
          <p className="mt-5 max-w-md text-lg text-ink-soft">
            {count("beans")} coffees, {count("gear")} pieces of brewing gear and {count("bundle")} gift sets from a roastery that does not exist.
            Every colour on this site is a taste. Browse it all; nothing is for sale.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/shop/${coffee.slug}`} className="btn btn-primary">
              Shop coffee
            </Link>
            <Link href="#tastes" className="btn btn-secondary">
              Find your taste
            </Link>
          </div>
        </div>
        <div className="order-1 aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand md:order-2 md:aspect-[5/6]">
          {lifestyle("hero", "Morning light on a kitchen table with a pour-over brewer, a cup of black coffee and a Demo Roasters pouch", "(min-width: 768px) 50vw, 100vw", true)}
        </div>
      </section>

      {/* Our favourites */}
      <section aria-labelledby="favourites" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 md:pt-28">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="favourites" className="text-3xl sm:text-5xl">
              Our favourites
            </h2>
            <p className="mt-2 text-ink-soft">Four coffees, four different tastes.</p>
          </div>
          <Link href={`/shop/${coffee.slug}`} className="shrink-0 font-semibold underline-offset-4 hover:underline">
            Shop all coffee
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {favourites.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* Promises: only what is true of this demo. */}
      <section aria-label="How this shop works" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 md:mt-28">
        <ul className="grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-line sm:grid-cols-3">
          {[
            { title: "Chosen by taste", text: "Every coffee lists what it tastes of, and its colour on the site shows its main taste." },
            { title: "Ground the way you brew", text: `${listJoin(GRINDS.map((g) => GRIND_LABEL[g].toLowerCase()))}: pick on any coffee, same price.` },
            {
              title: `Free delivery over ${formatPounds(DELIVERY.freeFromPence)}`,
              text: `Otherwise ${formatPrice(DELIVERY.flatPence)}. Pretend only: this demo never posts anything.`,
            },
          ].map((x) => (
            <li key={x.title} className="bg-sand p-6 sm:p-8">
              <p className="text-lg font-semibold">{x.title}</p>
              <p className="mt-2 text-[0.95rem] text-ink-soft">{x.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Ways to shop */}
      <section aria-labelledby="ways" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 md:pt-28">
        <h2 id="ways" className="text-3xl sm:text-5xl">
          Ways to shop
        </h2>
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {tiles.map((t) => (
            <li key={t.title} className="group relative">
              <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand">
                <div className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.04]">{lifestyle(t.image, t.alt, "(min-width: 1024px) 25vw, 50vw")}</div>
              </div>
              <h3 className="mt-4 text-xl">
                <Link href={t.href} className="after:absolute after:inset-0 group-hover:underline">
                  {t.title}
                </Link>
              </h3>
              <p className="mt-1 text-[0.95rem] text-ink-soft">{t.line}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Shop by taste: the colours are the tastes. */}
      <section id="tastes" aria-labelledby="tastes-title" className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-20 sm:px-6 md:pt-28">
        <h2 id="tastes-title" className="text-3xl sm:text-5xl">
          What do you like the taste of?
        </h2>
        <p className="mt-2 max-w-xl text-ink-soft">Pick a taste to see every coffee that has it. Many coffees have more than one.</p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TASTES.map((t) => (
            <li key={t.id}>
              <Link
                href={`/shop/coffee?taste=${t.id}`}
                className="flex h-32 flex-col justify-between rounded-[var(--radius-card)] p-4 text-[#141210] transition-transform duration-200 hover:-translate-y-1"
                style={{ background: t.colour }}
              >
                <span className="text-xl font-bold">{t.label}</span>
                <span className="text-sm">
                  {tasteCount(t.id)} {tasteCount(t.id) === 1 ? "coffee" : "coffees"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Brew guide */}
      <section aria-labelledby="brew" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 md:mt-28">
        <div className="grid overflow-hidden rounded-[var(--radius-card)] bg-sand md:grid-cols-2">
          <div className="aspect-[3/2] md:aspect-auto">{lifestyle("brew", "A home coffee corner with a hand grinder, a scale, a dripper and a kettle", "(min-width: 768px) 50vw, 100vw", false, 1392, 928)}</div>
          <div className="p-6 sm:p-10">
            <p className="label">Brew guide</p>
            <h2 id="brew" className="mt-3 text-3xl sm:text-4xl">
              Make the most of every cup.
            </h2>
            <ol className="mt-6 grid gap-5 sm:grid-cols-2">
              {BREW_STEPS.map((s, i) => (
                <li key={s.title}>
                  <p className="flex items-center gap-3 font-semibold">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-sm text-paper tabular-nums">{i + 1}</span>
                    {s.title}
                  </p>
                  <p className="mt-2 text-[0.95rem] text-ink-soft">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* About this demo */}
      <section aria-labelledby="about-demo" className="mx-auto max-w-3xl px-4 pt-20 text-center sm:px-6 md:pt-28">
        <p className="label">About this demo</p>
        <h2 id="about-demo" className="mt-3 text-3xl sm:text-4xl">
          A working shop, minus the selling.
        </h2>
        <p className="mt-5 text-lg text-ink-soft">
          Demo Roasters is a portfolio project by Cam, built to show a working online shop: a catalogue, search that understands plain
          English, a basket with test payments, customer accounts and an admin dashboard. Every part is working, with test payments only:
          nothing is sold and no money moves. Every product, farm and person is invented, and the photos are AI-generated.
        </p>
        <Link href="/about" className="btn btn-secondary mt-8">
          How it is built
        </Link>
      </section>
    </>
  );
}
