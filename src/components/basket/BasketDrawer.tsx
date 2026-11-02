"use client";

// The basket slides in from the right (a modal dialog: focus stays inside, Escape closes it).
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { DELIVERY, GRIND_LABEL } from "@/config/shop";
import { lineKey, roomFor } from "@/lib/basket";
import { formatPrice } from "@/lib/format";
import { CheckoutButton } from "./CheckoutButton";
import { QuantityStepper } from "./QuantityStepper";
import { useBasket } from "./BasketProvider";

export function BasketDrawer() {
  const { basket, totals, isOpen, open, close, setQuantity, remove, lastAdded, notice } = useBasket();
  const dialog = useRef<HTMLDialogElement>(null);

  // Back from Stripe's page with "?checkout=cancelled": reopen the basket, untouched, and say so. The flag is
  // removed from the address so a reload does not say it again.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") !== "cancelled") return;
    url.searchParams.delete("checkout");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    open("Checkout cancelled. Nothing was charged, and your basket is just as you left it.");
  }, [open]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  const freeShare = Math.min(100, Math.round((totals.subtotalPence / DELIVERY.freeFromPence) * 100));

  return (
    <dialog
      ref={dialog}
      aria-labelledby="basket-title"
      onClose={close}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md overscroll-contain bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 open:flex open:flex-col"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="basket-title" className="text-xl">
          Your basket{totals.itemCount > 0 ? ` (${totals.itemCount})` : ""}
        </h2>
        <button type="button" onClick={close} aria-label="Close basket" className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {lastAdded ?? ""}
      </p>
      {notice && (
        <p role="status" className="mx-5 mt-4 rounded-xl bg-sand px-4 py-3 text-sm font-medium">
          {notice}
        </p>
      )}

      {basket.lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold">Your basket is empty.</p>
          <p className="text-ink-soft">Find a coffee you like the taste of.</p>
          <Link href="/shop/coffee" onClick={close} className="btn btn-primary">
            Shop coffee
          </Link>
        </div>
      ) : (
        <>
          <div className="border-b border-line px-5 py-4">
            <p className="text-sm">
              {totals.toFreeDeliveryPence > 0 ? (
                <>
                  Spend <strong>{formatPrice(totals.toFreeDeliveryPence)}</strong> more for free delivery.
                </>
              ) : (
                <strong>Free delivery unlocked.</strong>
              )}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
              <div className="h-full origin-left rounded-full bg-accent transition-transform duration-300" style={{ transform: `scaleX(${freeShare / 100})` }} />
            </div>
          </div>

          <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
            {basket.lines.map((l) => {
              const key = lineKey(l);
              return (
                <li key={key} className="flex gap-4 py-4">
                  <Link href={`/products/${l.slug}`} onClick={close} className="shrink-0" tabIndex={-1} aria-hidden="true">
                    <Image src={`/products/${l.slug}.webp`} alt="" width={80} height={100} unoptimized className="h-[100px] w-20 rounded-xl object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/products/${l.slug}`} onClick={close} className="font-semibold leading-snug break-words hover:underline">
                          {l.name}
                        </Link>
                        {l.grind && <p className="text-sm text-ink-soft">{GRIND_LABEL[l.grind]}</p>}
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums">{formatPrice(l.pricePence * l.quantity)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <QuantityStepper value={l.quantity} max={l.quantity + roomFor(basket, l)} onChange={(q) => setQuantity(key, q)} label={`Quantity of ${l.name}`} small />
                      <button type="button" onClick={() => remove(key)} className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                        Remove<span className="sr-only"> {l.name}</span>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-line bg-sand px-5 py-5">
            <dl className="space-y-1.5 text-[0.95rem]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(totals.subtotalPence)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Delivery</dt>
                <dd className="tabular-nums">{totals.deliveryPence === 0 ? "Free" : formatPrice(totals.deliveryPence)}</dd>
              </div>
              <div className="flex justify-between pt-1.5 text-lg font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(totals.totalPence)}</dd>
              </div>
            </dl>
            <CheckoutButton />
          </div>
        </>
      )}
    </dialog>
  );
}
