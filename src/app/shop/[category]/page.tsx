import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AutoSubmitForm } from "@/components/AutoSubmitForm";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORY_PAGES, categoryBySlug } from "@/config/categories";
import { BREW_METHODS, ORIGINS, ROASTS } from "@/data/products";
import { listCatalogue } from "@/db/catalogue";
import { METHOD_LABEL, ROAST_LABEL } from "@/lib/format";
import { applyFilters, isFiltered, readFilters } from "@/lib/shop-filters";
import { TASTES, tastesOf } from "@/lib/taste";

export function generateStaticParams() {
  return CATEGORY_PAGES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const page = categoryBySlug((await params).category);
  return page ? { title: page.name, description: page.blurb, alternates: { canonical: `/shop/${page.slug}` } } : {};
}

const BANNER: Record<string, { image: string; alt: string }> = {
  coffee: { image: "coffee", alt: "Whole coffee beans spilling from a Demo Roasters pouch" },
  "brewing-gear": { image: "gear", alt: "Hot water poured from a gooseneck kettle into a pour-over dripper" },
  "gift-sets": { image: "gifts", alt: "A white gift box with a black ribbon beside a coffee pouch and a dripper" },
};

const NOUN = { beans: "coffees", gear: "pieces of brewing gear", bundle: "gift sets" } as const;

/** A filter pill: a native <details> menu of radio choices (works without JavaScript; pressing Apply sends it). */
function Pill({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <details className="group relative">
      <summary className={`chip cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden ${value ? "chip-on" : ""}`}>
        {value ? `${label}: ${value}` : label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="transition-transform group-open:rotate-180">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <fieldset className="absolute left-0 top-full z-20 mt-2 max-h-80 w-56 overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-xl">
        <legend className="sr-only">{label}</legend>
        {children}
      </fieldset>
    </details>
  );
}

function Choice({ name, value, label, checked, count }: { name: string; value: string; label: string; checked: boolean; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-[0.95rem] hover:bg-sand has-[:checked]:font-semibold">
      <span className="flex items-center gap-2.5">
        <input type="radio" name={name} value={value} defaultChecked={checked} className="h-4 w-4 accent-[var(--ink)]" />
        {label}
      </span>
      {count !== undefined && <span className="text-sm text-ink-soft tabular-nums">{count}</span>}
    </label>
  );
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="chip cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)] has-[:focus-visible]:outline">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="sr-only" />
      {label}
    </label>
  );
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/shop/[category]">) {
  const page = categoryBySlug((await params).category);
  if (!page) notFound();
  const filters = readFilters(await searchParams);
  const inCategory = (await listCatalogue()).filter((p) => p.category === page.category);
  const shown = applyFilters(inCategory, filters);
  const coffee = page.category === "beans";
  const methods = BREW_METHODS.filter((m) => inCategory.some((p) => p.brewMethods.includes(m)));
  const origins = ORIGINS.filter((o) => inCategory.some((p) => p.origins.includes(o)));
  const action = `/shop/${page.slug}`;
  const banner = BANNER[page.slug]!;
  const n = (pred: (p: (typeof inCategory)[number]) => boolean) => inCategory.filter(pred).length;
  const opt = (value: string, label: string, checked: boolean, count: number) => ({ value, label, checked, count });
  const groups = [
    ...(coffee
      ? [
          {
            name: "taste",
            label: "Taste",
            any: "Any taste",
            current: filters.taste ? TASTES.find((t) => t.id === filters.taste)!.label : undefined,
            options: TASTES.map((t) => opt(t.id, t.label, filters.taste === t.id, n((p) => tastesOf(p).includes(t.id)))),
          },
          {
            name: "roast",
            label: "Roast",
            any: "Any roast",
            current: filters.roast ? ROAST_LABEL[filters.roast] : undefined,
            options: ROASTS.map((r) => opt(r, ROAST_LABEL[r], filters.roast === r, n((p) => p.roast === r))),
          },
        ]
      : []),
    {
      name: "method",
      label: "Brewing method",
      any: "Any method",
      current: filters.method ? METHOD_LABEL[filters.method] : undefined,
      options: methods.map((m) => opt(m, METHOD_LABEL[m], filters.method === m, n((p) => p.brewMethods.includes(m)))),
    },
    ...(coffee
      ? [{ name: "origin", label: "Origin", any: "Any origin", current: filters.origin, options: origins.map((o) => opt(o, o, filters.origin === o, n((p) => p.origins.includes(o)))) }]
      : []),
  ];
  const toggles = [
    ...(coffee ? [{ name: "decaf", label: "Decaf only", checked: Boolean(filters.decaf) }] : []),
    { name: "stock", label: "In stock only", checked: Boolean(filters.inStock) },
  ];
  const active = groups.filter((g) => g.current).length + toggles.filter((t) => t.checked).length;
  const sortSelect = (
    <select name="sort" defaultValue={filters.sort} className="h-10 rounded-full border border-line bg-surface px-4 text-[0.95rem] text-ink">
      <option value="featured">In stock first</option>
      <option value="price-low">Price, low to high</option>
      <option value="price-high">Price, high to low</option>
      <option value="name">Name</option>
    </select>
  );

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 md:pt-10">
        <div className="grid items-center overflow-hidden rounded-[var(--radius-card)] bg-sand md:grid-cols-[1.3fr_1fr]">
          <div className="p-6 sm:p-10">
            <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
              <span aria-hidden="true" className="px-2">
                /
              </span>
              <span aria-current="page">{page.name}</span>
            </nav>
            <h1 className="mt-4 text-5xl sm:text-6xl">{page.name}</h1>
            <p className="mt-4 max-w-md text-lg text-ink-soft">{page.blurb}</p>
            <p className="label mt-5">
              {inCategory.length} {NOUN[page.category]}
            </p>
          </div>
          <div className="hidden aspect-[16/10] h-full md:block">
            <Image src={`/lifestyle/${banner.image}.webp`} alt={banner.alt} width={1120} height={1392} sizes="40vw" priority unoptimized className="h-full w-full object-cover" />
          </div>
        </div>
      </div>

      {/* Tablet and desktop: a sticky row of filter pills. */}
      <div className="sticky top-[6.5rem] z-20 mt-6 hidden border-y border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85 md:block">
        <AutoSubmitForm action={action} className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          {groups.map((g) => (
            <Pill key={g.name} label={g.label} value={g.current}>
              <Choice name={g.name} value="" label={g.any} checked={!g.current} />
              {g.options.map((o) => (
                <Choice key={o.value} name={g.name} value={o.value} label={o.label} checked={o.checked} count={o.count} />
              ))}
            </Pill>
          ))}
          {toggles.map((t) => (
            <Toggle key={t.name} name={t.name} label={t.label} checked={t.checked} />
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-ink-soft">
            Sort
            {sortSelect}
          </label>
          <noscript>
            <button type="submit" className="btn btn-primary h-10">
              Apply
            </button>
          </noscript>
        </AutoSubmitForm>
      </div>

      {/* Phones: one "Filter and sort" button that opens the same choices in the page (like the reference shops). */}
      <div className="mx-auto mt-5 max-w-7xl px-4 md:hidden">
        <details className="group rounded-[var(--radius-card)] border border-line">
          <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold [&::-webkit-details-marker]:hidden">
            <span>
              Filter and sort
              {active > 0 && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs text-paper">{active}</span>}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="transition-transform group-open:rotate-180">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <AutoSubmitForm action={action} className="space-y-5 border-t border-line px-4 py-4">
            {groups.map((g) => (
              <fieldset key={g.name}>
                <legend className="label">{g.label}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[{ value: "", label: g.any, checked: !g.current }, ...g.options].map((o) => (
                    <label key={o.value} className="chip cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)] has-[:focus-visible]:outline">
                      <input type="radio" name={g.name} value={o.value} defaultChecked={o.checked} className="sr-only" />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              {toggles.map((t) => (
                <Toggle key={t.name} name={t.name} label={t.label} checked={t.checked} />
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Sort
              {sortSelect}
            </label>
            <noscript>
              <button type="submit" className="btn btn-primary w-full">
                Apply
              </button>
            </noscript>
          </AutoSubmitForm>
        </details>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-baseline justify-between py-5">
          {/* A real heading between the page title and the product names, for screen-reader navigation. */}
          <h2 className="text-[0.95rem] font-normal tracking-normal text-ink-soft" aria-live="polite">
            {shown.length === 1 ? "1 product" : `${shown.length} products`}
            {isFiltered(filters) ? ` of ${inCategory.length}` : ""}
          </h2>
          {isFiltered(filters) && (
            <Link href={action} className="text-[0.95rem] font-semibold underline underline-offset-4 hover:text-accent">
              Clear filters
            </Link>
          )}
        </div>

        {shown.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
            {shown.map((p, i) => (
              <ProductCard key={p.slug} product={p} priority={i < 4} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] bg-sand px-6 py-14 text-center">
            <p className="text-2xl font-bold">Nothing matches all of those filters.</p>
            <p className="mt-2 text-ink-soft">Remove one to see more of the {page.name.toLowerCase()} range.</p>
            <Link href={action} className="btn btn-primary mt-6">
              Clear filters
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
