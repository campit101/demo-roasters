"use client";

// Demo banner, then logo, shop links (Coffee opens a menu of ways to shop), theme switch and basket.
// Phones get a menu button that opens the same links in a panel. Search and account sit by the basket.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEMO_BANNER } from "@/config/shop";
import { ROASTS } from "@/data/products";
import { METHOD_LABEL, ROAST_LABEL } from "@/lib/format";
import { TASTES } from "@/lib/taste";
import { BasketButton } from "./basket/BasketButton";
import { HeaderSearch } from "./search/HeaderSearch";
import { ThemeToggle } from "./ThemeToggle";

const COFFEE_MENU = [
  { title: "By taste", links: TASTES.map((t) => ({ label: t.label, href: `/shop/coffee?taste=${t.id}` })) },
  { title: "By roast", links: ROASTS.map((r) => ({ label: ROAST_LABEL[r], href: `/shop/coffee?roast=${r}` })) },
  {
    title: "By method",
    links: (["espresso", "pour-over", "cafetiere", "moka-pot", "cold-brew"] as const).map((m) => ({ label: METHOD_LABEL[m], href: `/shop/coffee?method=${m}` })),
  },
];

const LINKS = [
  { label: "Brewing gear", href: "/shop/brewing-gear" },
  { label: "Gift sets", href: "/shop/gift-sets" },
  { label: "About", href: "/about" },
];

const navLink = "rounded-full px-3 py-2 text-[0.95rem] font-medium hover:bg-sand";

export function SiteHeader() {
  const pathname = usePathname();
  const [coffeeOpen, setCoffeeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Close menus after navigating (adjusting state during render, as React recommends, not in an effect).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setCoffeeOpen(false);
    setMenuOpen(false);
  }
  const menu = useRef<HTMLDialogElement>(null);
  const coffee = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = menu.current;
    if (!d) return;
    if (menuOpen && !d.open) d.showModal();
    if (!menuOpen && d.open) d.close();
  }, [menuOpen]);

  // The Coffee menu closes on Escape or a click outside it.
  useEffect(() => {
    if (!coffeeOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCoffeeOpen(false);
    const onClick = (e: MouseEvent) => !coffee.current?.contains(e.target as Node) && setCoffeeOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [coffeeOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <p className="bg-banner px-4 py-2 text-center text-[0.8rem] font-medium text-banner-ink">{DEMO_BANNER}</p>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/" translate="no" aria-label="Demo Roasters, home" className="whitespace-nowrap text-[1.05rem] font-extrabold tracking-tight sm:text-xl lg:mr-6">
          DEMO ROASTERS
        </Link>

        <nav aria-label="Shop" className="hidden flex-1 items-center gap-1 lg:flex">
          <div ref={coffee} className="relative">
            <button type="button" aria-expanded={coffeeOpen} aria-controls="coffee-menu" onClick={() => setCoffeeOpen((o) => !o)} className={`${navLink} inline-flex items-center gap-1`}>
              Coffee
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`transition-transform ${coffeeOpen ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div id="coffee-menu" hidden={!coffeeOpen} className="absolute left-0 top-full mt-2 w-[44rem] rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-xl">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-6">
                {COFFEE_MENU.map((g) => (
                  <div key={g.title}>
                    <p className="label">{g.title}</p>
                    <ul className="mt-3 space-y-1.5">
                      {g.links.map((l) => (
                        <li key={l.href}>
                          <Link href={l.href} className="hover:underline">
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Link href="/shop/coffee" className="btn btn-primary self-end">
                  All coffee
                </Link>
              </div>
            </div>
          </div>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined} className={navLink}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center sm:gap-1">
          {/* Phones keep the header to menu, logo, search, account and basket; the theme switch is in the menu there. */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <HeaderSearch />
          <Link href="/account" aria-label="Your account" className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="8.5" r="3.5" />
              <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" />
            </svg>
          </Link>
          <BasketButton />
        </div>
      </div>

      <dialog
        ref={menu}
        aria-label="Menu"
        onClose={() => setMenuOpen(false)}
        onClick={(e) => e.target === e.currentTarget && setMenuOpen(false)}
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(22rem,88vw)] overscroll-contain bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-extrabold tracking-tight" translate="no">
            DEMO ROASTERS
          </p>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav aria-label="Menu links" className="px-5 py-4">
          <Link href="/shop/coffee" className="block py-3 text-2xl font-bold">
            Coffee
          </Link>
          {COFFEE_MENU.slice(0, 2).map((g) => (
            <div key={g.title} className="pb-3">
              <p className="label">{g.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.links.map((l) => (
                  <Link key={l.href} href={l.href} className="chip">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block border-t border-line py-3 text-2xl font-bold">
              {l.label}
            </Link>
          ))}
          <Link href="/account" className="block border-t border-line py-3 text-2xl font-bold">
            Your account
          </Link>
          <div className="flex items-center justify-between border-t border-line py-3">
            <span className="text-[0.95rem] font-semibold">Light or dark</span>
            <ThemeToggle />
          </div>
        </nav>
      </dialog>
    </header>
  );
}
