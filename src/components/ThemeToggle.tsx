"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const read = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};

/** Switches light and dark. The choice is saved on this device only (localStorage), and only when changed. */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, read, () => "light");
  const next: Theme = theme === "dark" ? "light" : "dark";

  // The inline script in the layout sets the theme before paint. Pages Next renders in the browser
  // (for example a not-found product) never run that script, so apply the same choice here too.
  // Light unless the visitor chose dark with this switch.
  useEffect(() => {
    let wanted = "light";
    try {
      if (localStorage.getItem("theme") === "dark") wanted = "dark";
    } catch {
      // Storage blocked: stay light.
    }
    if (document.documentElement.getAttribute("data-theme") !== wanted) document.documentElement.setAttribute("data-theme", wanted);
  }, []);
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          // Private browsing can block storage; the switch still works for this visit.
        }
      }}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand hover:text-ink"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === "dark" ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
