"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** A plain GET form that also applies each change straight away when JavaScript is on. */
export function AutoSubmitForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <form
      method="get"
      action={action}
      autoComplete="off"
      className={className}
      onChange={(e) => {
        // Filter pills are <details> menus: close them once a choice is made.
        e.currentTarget.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
        const params = new URLSearchParams();
        for (const [k, v] of new FormData(e.currentTarget)) if (typeof v === "string" && v && v !== "featured") params.set(k, v);
        const qs = params.toString();
        router.replace(qs ? `${action}?${qs}` : action, { scroll: false });
      }}
    >
      {children}
    </form>
  );
}
