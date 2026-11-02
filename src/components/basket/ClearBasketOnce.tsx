"use client";

// On a paid order's page: empties the basket, but only if this device checked out as this order, and only once,
// so revisiting the page later never wipes a new basket.
import { useEffect } from "react";
import { useBasket } from "./BasketProvider";
import { CHECKOUT_REFERENCE_KEY } from "./CheckoutButton";

export function ClearBasketOnce({ reference }: { reference: string }) {
  const { clear } = useBasket();
  useEffect(() => {
    try {
      if (localStorage.getItem(CHECKOUT_REFERENCE_KEY) !== reference) return;
      localStorage.removeItem(CHECKOUT_REFERENCE_KEY);
    } catch {
      return;
    }
    clear();
  }, [clear, reference]);
  return null;
}
