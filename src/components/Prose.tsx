import type { ReactNode } from "react";

/** Long-form text pages (privacy, terms, about): readable measure, quiet hierarchy. */
export function Prose({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
      <h1 className="text-4xl sm:text-5xl">{title}</h1>
      {updated && <p className="mt-3 text-[0.95rem] text-ink-soft">Last updated {updated}</p>}
      <div className="mt-8 space-y-5 text-[1.05rem] leading-relaxed [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-6 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
