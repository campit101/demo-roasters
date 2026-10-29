import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductCard } from "@/components/ProductCard";
import { SearchForm } from "@/components/search/SearchForm";
import { CATEGORY_PAGES } from "@/config/categories";
import { TASTES } from "@/lib/taste";
import { SEARCH_EXAMPLES } from "@/search/examples";
import type { Chip, ParsedQuery } from "@/search/parse";
import { chipId, readSearchRequest, searchHref } from "@/search/request";
import type { SearchOutcome } from "@/search/run";
import { searchForPage } from "@/search/server";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = readSearchRequest(await searchParams);
  // Search results are never indexed, even after search engines are let in (robots.ts also blocks /search).
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false, follow: true } };
}

/** “smooth” and “nutty”: each word quoted, so it is clear which words the search used. */
const quote = (words: readonly string[], joiner = "and") => {
  const q = words.map((w) => `“${w}”`);
  return q.length <= 1 ? (q[0] ?? "") : `${q.slice(0, -1).join(", ")} ${joiner} ${q.at(-1)}`;
};

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mt-5 rounded-2xl border border-line bg-sand px-5 py-4 text-[0.95rem]">
      {children}
    </p>
  );
}

/** What the search understood: one chip per filter (× removes it), removed chips (+ puts one back), and the words. */
function Understood({ q, drops, parsed, dropped }: { q: string; drops: string[]; parsed: ParsedQuery; dropped: Chip[] }) {
  if (!parsed.chips.length && !dropped.length && !parsed.terms.length && !parsed.corrections.length) return null;
  const without = (id: string) => drops.filter((d) => d !== id);
  return (
    <section aria-labelledby="understood" className="mt-6">
      {/* A labelled paragraph, not a heading: global heading styles would override the spaced-capital label. */}
      <p id="understood" className="label">
        Understood from your search
      </p>
      <ul className="mt-3 flex flex-wrap items-center gap-2">
        {parsed.chips.map((c) => (
          <li key={chipId(c)}>
            <Link href={searchHref(q, [...drops, chipId(c)])} prefetch={false} aria-label={`Remove ${c.label}`} className="chip chip-on">
              {c.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </Link>
          </li>
        ))}
        {dropped.map((c) => (
          <li key={chipId(c)}>
            <Link href={searchHref(q, without(chipId(c)))} prefetch={false} aria-label={`Put back ${c.label}`} className="chip border-dashed text-ink-soft">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <s>{c.label}</s>
            </Link>
          </li>
        ))}
        {parsed.terms.length > 0 && (
          <li className={`text-[0.95rem] text-ink-soft ${parsed.chips.length || dropped.length ? "px-1" : ""}`}>
            {parsed.chips.length || dropped.length ? "plus " : ""}
            {parsed.chips.length || dropped.length ? "the " : "The "}
            {parsed.terms.length === 1 ? "word " : "words "}
            <span className="font-semibold text-ink">{quote(parsed.terms)}</span>
            {parsed.avoid.length > 0 && <>, avoiding {quote(parsed.avoid, "or")}</>}
          </li>
        )}
      </ul>
      {parsed.corrections.length > 0 && (
        <p className="mt-3 text-[0.95rem] text-ink-soft">
          {parsed.corrections.map((c, i) => (
            <span key={`${c.from}-${c.to}`}>
              {i === 0 ? "Read " : ", "}“{c.from}” as “{c.to}”
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}

function Ideas({ heading }: { heading: string }) {
  return (
    <section aria-labelledby="ideas" className="mt-10">
      <h2 id="ideas" className="text-2xl sm:text-3xl">
        {heading}
      </h2>
      <div className="mt-6 grid gap-8 md:grid-cols-3">
        <div>
          <p className="label">Search for</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SEARCH_EXAMPLES.map((q) => (
              <li key={q}>
                <Link href={searchHref(q)} prefetch={false} className="chip">
                  {q}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label">Shop by taste</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {TASTES.map((t) => (
              <li key={t.id}>
                <Link href={`/shop/coffee?taste=${t.id}`} className="chip">
                  <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: t.colour }} />
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label">Browse</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_PAGES.map((c) => (
              <li key={c.slug}>
                <Link href={`/shop/${c.slug}`} className="chip">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Results({ outcome, q, drops }: { outcome: Exclude<SearchOutcome, { status: "idle" }>; q: string; drops: string[] }) {
  const understood = <Understood q={q} drops={drops} parsed={outcome.parsed} dropped={outcome.dropped} />;
  if (outcome.status === "limited") {
    const wait = outcome.retryAfterSeconds;
    return (
      <>
        {understood}
        <Notice>
          That is a lot of searches in one minute, so this one has been paused. Please try again in {wait === 1 ? "1 second" : `${wait} seconds`}.
        </Notice>
      </>
    );
  }
  const { results, parsed } = outcome;
  return (
    <>
      {understood}
      {outcome.keywordOnly === "daily-limit" && (
        <Notice>Today’s searches with the meaning model have all been used, so these results match your words and filters only. Full search returns after midnight (UK time).</Notice>
      )}
      {outcome.keywordOnly === "model-unavailable" && <Notice>The meaning model is not available right now, so these results match your words and filters only.</Notice>}
      {outcome.loose && results.length > 0 && <Notice>Nothing matched {quote(parsed.terms, "or")}, so here is everything that fits the rest of your search.</Notice>}
      {outcome.meaningOnly && <Notice>No product mentions {quote(parsed.terms, "or")}, so these are the closest matches by meaning.</Notice>}

      {/* Kept for screen readers when empty; the empty-state box says it visually. */}
      <h2 className={`mt-8 text-[0.95rem] font-normal tracking-normal text-ink-soft ${results.length ? "" : "sr-only"}`} aria-live="polite">
        {results.length === 1 ? "1 product" : `${results.length} products`}
      </h2>
      {results.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {results.map((r, i) => (
            <ProductCard key={r.product.slug} product={r.product} priority={i < 2} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[var(--radius-card)] bg-sand px-6 py-12 text-center">
          <p className="text-2xl font-bold">Nothing in the shop matches all of that.</p>
          <p className="mx-auto mt-2 max-w-lg text-ink-soft">
            {parsed.chips.length ? "Try removing one of the filters above, or search in different words. " : "Try different words. "}
            Search only shows products that are in stock.
          </p>
        </div>
      )}
    </>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q, drops } = readSearchRequest(await searchParams);
  const outcome = await searchForPage({ q, drops });
  const empty = outcome.status === "done" && outcome.results.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 pt-6 sm:px-6 md:pt-10">
      {/* With a query the banner stays compact (title beside the box on desktop) so results start high up. */}
      <div className={`rounded-[var(--radius-card)] bg-sand p-6 ${q ? "sm:p-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-end lg:gap-10" : "sm:p-10"}`}>
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
            <span aria-hidden="true" className="px-2">
              /
            </span>
            <span aria-current="page">Search</span>
          </nav>
          {q ? (
            <>
              <p className="label mt-4">Search results for</p>
              <h1 className="mt-2 break-words text-3xl sm:text-5xl">{quote([q])}</h1>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-5xl sm:text-6xl">Search</h1>
              <p className="mt-4 max-w-xl text-lg text-ink-soft">Describe what you like in your own words: a taste, a price, how you brew. Results come straight from the shop, with live prices and stock.</p>
            </>
          )}
        </div>
        <div className={q ? "mt-6 lg:mt-0" : "mt-6 max-w-2xl"}>
          <SearchForm key={q} defaultValue={q} />
        </div>
      </div>

      {outcome.status === "idle" ? <Ideas heading="Not sure where to start?" /> : <Results outcome={outcome} q={q} drops={drops} />}
      {empty && <Ideas heading="Ideas to try instead" />}
    </div>
  );
}
