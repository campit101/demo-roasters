import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AddToBasket } from "@/components/AddToBasket";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { RoastScale } from "@/components/RoastScale";
import { categoryPage } from "@/config/categories";
import { DELIVERY, GRIND_LABEL } from "@/config/shop";
import { getProduct, listCatalogue } from "@/db/catalogue";
import { cardLine, formatPrice, listJoin, METHOD_LABEL, ROAST_LABEL, formatPounds } from "@/lib/format";
import { tasteById, tastesOf } from "@/lib/taste";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await listCatalogue()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  return { title: p.name, description: p.description, alternates: { canonical: `/products/${p.slug}` } };
}

const GRIND_GUIDE = [
  ["whole-bean", "Keeps freshest. Grind just before you brew."],
  ["espresso", "Fine, like flour. For espresso machines."],
  ["filter", "Medium, like sand. For pour-over and filter machines."],
  ["cafetiere", "Coarse, like sea salt. For cafetières and cold brew."],
  ["moka-pot", "Fine to medium. For stovetop moka pots."],
] as const;

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="transition-transform group-open:rotate-45">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="pb-5 text-[0.95rem] text-ink-soft">{children}</div>
    </details>
  );
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const range = categoryPage(p.category);
  const coffee = p.category === "beans";
  const soldOut = p.stock <= 0;
  const tastes = tastesOf(p).map(tasteById);
  const bag: [string, string][] = [
    ...(p.origins.length ? ([[p.origins.length > 1 ? "Origins" : "Origin", listJoin(p.origins)]] as [string, string][]) : []),
    ...(p.roast ? ([["Roast", ROAST_LABEL[p.roast]]] as [string, string][]) : []),
    ...(p.flavourNotes.length ? ([["Tastes of", listJoin(p.flavourNotes)]] as [string, string][]) : []),
    ["Brew with", listJoin(p.brewMethods.map((m, i) => (i === 0 ? METHOD_LABEL[m] : METHOD_LABEL[m].toLowerCase())))],
    ...(p.caffeine ? ([["Caffeine", p.caffeine === "decaf" ? "Decaf (water process)" : "Regular"]] as [string, string][]) : []),
    ["Size", p.size],
  ];
  const related = (await listCatalogue()).filter((x) => x.category === p.category && x.slug !== p.slug && x.stock > 0).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <nav aria-label="Breadcrumb" className="pt-6 text-sm text-ink-soft">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <Link href={`/shop/${range.slug}`} className="hover:text-ink">
          {range.name}
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span aria-current="page">{p.name}</span>
      </nav>

      <div className="grid gap-8 pb-28 pt-5 md:grid-cols-[1.1fr_1fr] md:gap-14 md:pb-0">
        <div className={`self-start md:sticky md:top-28 ${soldOut ? "opacity-80" : ""}`}>
          <ProductImage product={p} priority sizes="(min-width: 768px) 50vw, 100vw" alt={`Photo of ${p.name}`} />
        </div>

        <div className="md:pt-2">
          <p className="label">{cardLine(p)}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{p.name}</h1>
          {p.flavourNotes.length > 0 && <p className="mt-3 text-lg text-ink-soft">{listJoin(p.flavourNotes)}</p>}
          <p className="mt-4 text-2xl font-bold tabular-nums">{formatPrice(p.pricePence)}</p>
          {p.roast && coffee && <RoastScale roast={p.roast} className="mt-3" />}
          {tastes.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tastes">
              {tastes.map((t) => (
                <li key={t.id}>
                  <Link href={`/shop/coffee?taste=${t.id}`} className="inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold text-[#141210]" style={{ background: t.colour }}>
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <AddToBasket product={p} />

          <p className="mt-3 text-sm text-ink-soft">
            {soldOut ? "Out of stock in this demo. " : ""}Delivery {formatPrice(DELIVERY.flatPence)}, free over {formatPounds(DELIVERY.freeFromPence)}. Pretend only:
            nothing is posted.
          </p>

          <ul className="mt-6 grid grid-cols-3 gap-2 text-center text-[0.8rem] sm:text-sm">
            {[
              coffee ? ["Pick your grind", "same price"] : ["Free delivery", `over ${formatPounds(DELIVERY.freeFromPence)}`],
              ["Test payments", "nothing is charged"],
              ["Invented shop", "every detail is made up"],
            ].map(([a, b]) => (
              <li key={a} className="rounded-2xl bg-sand px-2 py-3">
                <p className="font-semibold">{a}</p>
                <p className="text-ink-soft">{b}</p>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-prose text-lg leading-relaxed">{p.description}</p>

          <div className="mt-6 border-t border-line">
            <Fold title="Delivery and returns">
              Delivery is {formatPrice(DELIVERY.flatPence)} to the UK and free on orders over {formatPounds(DELIVERY.freeFromPence)}. This is a portfolio
              demo: payments are test only, nothing is ever posted and there is nothing to return.
            </Fold>
            {coffee && (
              <Fold title="Which grind should I choose?">
                <ul className="space-y-1.5">
                  {GRIND_GUIDE.map(([g, text]) => (
                    <li key={g}>
                      <strong className="text-ink">{GRIND_LABEL[g]}:</strong> {text}
                    </li>
                  ))}
                </ul>
              </Fold>
            )}
          </div>
        </div>
      </div>

      {/* In the bag: the facts as cards, like a spec sheet. */}
      <section aria-labelledby="in-the-bag" className="mt-16 rounded-[var(--radius-card)] bg-sand p-6 sm:p-10 md:mt-24">
        <h2 id="in-the-bag" className="text-2xl sm:text-4xl">
          {coffee ? "In the bag" : "The details"}
        </h2>
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {bag.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-paper p-4">
              <dt className="label">{k}</dt>
              <dd className="mt-1.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {coffee && (
        <section aria-labelledby="brew-it" className="mt-16 md:mt-24">
          <h2 id="brew-it" className="text-2xl sm:text-4xl">
            How to brew it
          </h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Weigh", "15 g of coffee for a 250 ml cup."],
              ["Grind", `Matched to your brewer; ${p.brewMethods[0] ? METHOD_LABEL[p.brewMethods[0]].toLowerCase() : "pour-over"} suits this one well.`],
              ["Bloom", "Wet the grounds with water just off the boil, wait 30 seconds."],
              ["Pour", "Add the rest slowly. About 3 minutes in all."],
            ].map(([title, text], i) => (
              <li key={title} className="border-t-2 border-ink pt-4">
                <p className="font-semibold">
                  <span className="tabular-nums">{i + 1}.</span> {title}
                </p>
                <p className="mt-1.5 text-[0.95rem] text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-16 md:mt-24">
          <div className="flex items-end justify-between gap-4">
            <h2 id="related" className="text-2xl sm:text-4xl">
              You might also like
            </h2>
            <Link href={`/shop/${range.slug}`} className="shrink-0 font-semibold underline-offset-4 hover:underline">
              All {range.name.toLowerCase()}
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.slug} product={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
