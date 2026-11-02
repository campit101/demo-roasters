"use client";

// The search icon by the basket. It is a link to /search (so it works without JavaScript); with JavaScript it
// opens a search panel across the top of the page instead, like the reference shops. Enter shows the results.
import { useCallback, useEffect, useRef, useState } from "react";
import { SEARCH_EXAMPLES } from "@/search/examples";
import { SearchForm } from "./SearchForm";

export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal moves focus to the first button, so put it in the box (found by the e2e test).
      d.querySelector<HTMLInputElement>('input[name="q"]')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <a
        href="/search"
        aria-label="Search"
        aria-haspopup="dialog"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setOpen(true);
        }}
        className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand"
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </a>
      <dialog
        ref={dialog}
        aria-label="Search the shop"
        onClose={close}
        onClick={(e) => e.target === e.currentTarget && close()}
        // A search box's own Escape only clears its text; here Escape always closes the panel.
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          close();
        }}
        className="fixed inset-x-0 top-0 bottom-auto m-0 max-h-dvh w-full max-w-none overflow-y-auto overscroll-contain border-b border-line bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        {/* Rendered only while open, so the box is empty and focused each time. */}
        {open && (
          <div className="mx-auto max-w-3xl px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-8">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-2xl font-bold tracking-tight">What are you looking for?</p>
              <button type="button" onClick={close} aria-label="Close search" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-sand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <SearchForm examples={SEARCH_EXAMPLES} onNavigated={close} />
            <p className="mt-6 text-sm text-ink-soft">Describe it in your own words: a taste, a price, how you brew. Results come straight from the shop, with live prices and stock.</p>
          </div>
        )}
      </dialog>
    </>
  );
}
