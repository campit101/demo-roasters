"use client";

// Sends the basket (slug, grind and quantity only) to the server, which prices it, holds the stock and returns
// Stripe's hosted test-mode page. If the server refuses, the reason is shown above the button.
import { useEffect, useState } from "react";
import { CHECKOUT } from "@/config/shop";
import { useBasket } from "./BasketProvider";

/** Remembered so the order page clears this basket only for the order it was checked out as. */
export const CHECKOUT_REFERENCE_KEY = "checkout-reference";

function returnPath(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("checkout");
  return url.pathname + url.search;
}

export function CheckoutButton() {
  const { basket } = useBasket();
  const [busy, setBusy] = useState(false);
  const lines = basket.lines.map(({ slug, grind, quantity }) => ({ slug, grind, quantity }));
  const signature = JSON.stringify(lines);
  // A refusal belongs to the basket it was about: once the visitor changes the basket, it disappears.
  const [refusal, setRefusal] = useState<{ message: string; signature: string } | null>(null);
  const error = refusal?.signature === signature ? refusal.message : null;
  const setError = (message: string) => setRefusal({ message, signature });

  // Coming back from Stripe with the browser's Back button can restore this page as it was left: busy.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setBusy(false);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  async function checkout() {
    setBusy(true);
    setRefusal(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines, returnTo: returnPath() }),
      });
      const data = (await res.json()) as { ok: boolean; url?: string; reference?: string; message?: string };
      if (data.ok && data.url && data.reference) {
        try {
          localStorage.setItem(CHECKOUT_REFERENCE_KEY, data.reference);
        } catch {
          // Without storage the basket is simply not emptied after payment.
        }
        window.location.assign(data.url);
        return;
      }
      setError(data.message ?? "Checkout could not start. Please try again.");
    } catch {
      setError("Could not reach the shop. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <p role="alert" className={error ? "mt-4 rounded-xl border border-accent px-4 py-3 text-sm font-medium" : "sr-only"}>
        {error ?? ""}
      </p>
      <button
        type="button"
        onClick={checkout}
        disabled={busy || basket.lines.length === 0}
        aria-busy={busy}
        aria-describedby="checkout-note"
        className="btn btn-primary mt-4 w-full aria-busy:cursor-wait aria-busy:opacity-100"
      >
        {busy && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="motion-safe:animate-spin">
            <path d="M12 3a9 9 0 1 1-9 9" strokeLinecap="round" />
          </svg>
        )}
        {busy ? "Opening secure checkout…" : "Checkout"}
      </button>
      <p id="checkout-note" className="mt-2 text-center text-sm text-ink-soft">
        Stripe test mode: no real money is taken. Pay with card{" "}
        <span translate="no" className="whitespace-nowrap tabular-nums">
          {CHECKOUT.testCard}
        </span>
        .
      </p>
    </>
  );
}
