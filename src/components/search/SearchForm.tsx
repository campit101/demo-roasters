"use client";

// The search box. A plain GET form to /search, so it works without JavaScript; with it, the results load
// in place and the button says "Searching…" until they arrive. Example links share the same loading state.
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useTransition, type MouseEvent } from "react";
import { searchUrl } from "@/search/examples";

export function SearchForm({
  defaultValue = "",
  examples = [],
  onNavigated,
}: {
  defaultValue?: string;
  examples?: readonly string[];
  /** Called once a search started here has finished loading (the header panel closes then). */
  onNavigated?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) onNavigated?.();
    wasPending.current = pending;
  }, [pending, onNavigated]);

  const go = (q: string) => startTransition(() => router.push(searchUrl(q)));
  const follow = (e: MouseEvent<HTMLAnchorElement>, q: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    go(q);
  };

  return (
    <div>
      <form
        action="/search"
        method="get"
        role="search"
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
          if (q) go(q);
        }}
        className="flex gap-2"
      >
        <label htmlFor={id} className="sr-only">
          Search the shop
        </label>
        <div className="relative min-w-0 flex-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            id={id}
            name="q"
            type="search"
            required
            defaultValue={defaultValue}
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Try “decaf under £12”…"
            className="h-14 w-full rounded-full border border-line bg-surface pl-12 pr-4 text-[1.05rem] text-ink placeholder:text-ink-soft focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:text-lg [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
        {/* Phones show an arrow so the box keeps its width; the word stays for screen readers. */}
        <button type="submit" disabled={pending} className="btn btn-primary h-14 w-14 shrink-0 px-0 sm:w-auto sm:px-7">
          <span className="sr-only sm:not-sr-only">{pending ? "Searching…" : "Search"}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className={`sm:hidden ${pending ? "motion-safe:animate-pulse" : ""}`}>
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      {examples.length > 0 && (
        <div className="mt-6">
          <p className="label" id={`${id}-try`}>
            Try
          </p>
          <ul aria-labelledby={`${id}-try`} className="mt-3 flex flex-wrap gap-2">
            {examples.map((q) => (
              <li key={q}>
                <a href={searchUrl(q)} onClick={(e) => follow(e, q)} className="chip">
                  {q}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
