"use client";

import { useBasket } from "./BasketProvider";

export function BasketButton() {
  const { totals, open } = useBasket();
  const n = totals.itemCount;
  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label={n ? `Basket, ${n} ${n === 1 ? "item" : "items"}` : "Basket, empty"}
      className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-sand"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" strokeLinejoin="round" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </svg>
      {n > 0 && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.7rem] font-bold text-paper tabular-nums">
          {n}
        </span>
      )}
    </button>
  );
}
