"use client";

// Product page buying box: grind chips (coffee), quantity stepper and Add to basket. On phones the button and
// price stay fixed to the bottom of the screen so they are always visible (DESIGN.md must-have).
import { useState } from "react";
import { GRINDS, GRIND_LABEL, LIMITS, type Grind } from "@/config/shop";
import { roomFor } from "@/lib/basket";
import type { Product } from "@/data/products";
import { formatPrice } from "@/lib/format";
import { useBasket } from "./basket/BasketProvider";
import { QuantityStepper } from "./basket/QuantityStepper";

export function AddToBasket({ product: p }: { product: Pick<Product, "slug" | "name" | "pricePence" | "category" | "stock"> }) {
  const { add, basket } = useBasket();
  const coffee = p.category === "beans";
  const [grind, setGrind] = useState<Grind>("whole-bean");
  const [quantity, setQuantity] = useState(1);
  const soldOut = p.stock <= 0;
  // The same caps as checkout: per product and per order, counting what is already in the basket.
  const room = Math.min(roomFor(basket, { slug: p.slug, grind: coffee ? grind : null }), p.stock);
  const full = !soldOut && room < 1;
  const max = Math.max(1, room);
  const count = Math.min(quantity, max);

  return (
    <div>
      {coffee && (
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold">Grind</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {GRINDS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={grind === g}
                onClick={() => setGrind(g)}
                disabled={soldOut}
                className="chip disabled:opacity-50"
              >
                {GRIND_LABEL[g]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper px-4 py-3 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          {!soldOut && !full && <QuantityStepper value={count} max={max} onChange={setQuantity} label="Quantity" />}
          <button
            type="button"
            disabled={soldOut || full}
            onClick={() => add({ slug: p.slug, name: p.name, pricePence: p.pricePence, grind: coffee ? grind : null }, count)}
            className="btn btn-primary min-w-0 flex-1 px-4"
          >
            {soldOut ? "Out of stock" : full ? "Basket limit reached" : `Add to basket · ${formatPrice(p.pricePence * count)}`}
          </button>
        </div>
        {full && (
          <p className="mx-auto mt-2 max-w-7xl text-sm text-ink-soft">
            Up to {LIMITS.maxQuantityPerProduct} of each item and {LIMITS.maxUnitsPerCheckout} items per order in this demo.
          </p>
        )}
      </div>
    </div>
  );
}
