"use client";

// The basket for the whole site. Saved on this device only (localStorage) and shared between tabs. Checkout sends
// only slug, grind and quantity; the server prices it again. Rules live in src/lib/basket.ts.
import { createContext, use, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { addLine, basketTotals, EMPTY, parseBasket, removeLine, setQuantity, type Basket, type BasketItem } from "@/lib/basket";

const KEY = "basket";
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: Basket = EMPTY;

function read(): Basket {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked (private mode or settings): the basket simply starts empty.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseBasket(raw);
  }
  return cached;
}

function write(next: Basket) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Without storage the basket still works until the page is closed.
    cachedRaw = JSON.stringify(next);
    cached = next;
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

interface BasketApi {
  basket: Basket;
  totals: ReturnType<typeof basketTotals>;
  add: (item: BasketItem, quantity: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  /** Empties the basket (after a paid order). */
  clear: () => void;
  isOpen: boolean;
  /** Opens the drawer, optionally with a notice at the top (for example after a cancelled checkout). */
  open: (notice?: string) => void;
  close: () => void;
  /** Last thing added, for the drawer's live message. */
  lastAdded: string | null;
  notice: string | null;
}

const BasketContext = createContext<BasketApi | null>(null);

export function BasketProvider({ children }: { children: ReactNode }) {
  const basket = useSyncExternalStore(subscribe, read, () => EMPTY);
  const [isOpen, setOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = useCallback((item: BasketItem, quantity: number) => {
    write(addLine(read(), item, quantity));
    setLastAdded(`${item.name} added to your basket.`);
    setNotice(null);
    setOpen(true);
  }, []);
  const api = useMemo<BasketApi>(
    () => ({
      basket,
      totals: basketTotals(basket),
      add,
      setQuantity: (key, q) => write(setQuantity(read(), key, q)),
      remove: (key) => write(removeLine(read(), key)),
      clear: () => write(EMPTY),
      isOpen,
      open: (message) => {
        setLastAdded(null);
        setNotice(message ?? null);
        setOpen(true);
      },
      close: () => setOpen(false),
      lastAdded,
      notice,
    }),
    [basket, add, isOpen, lastAdded, notice],
  );
  return <BasketContext value={api}>{children}</BasketContext>;
}

export function useBasket(): BasketApi {
  const api = use(BasketContext);
  if (!api) throw new Error("useBasket must be used inside BasketProvider");
  return api;
}
