import { ROASTS, type Roast } from "@/data/products";
import { ROAST_LABEL } from "@/lib/format";

/** Four steps from light to dark, filled up to this coffee's roast. Real information, not decoration. */
export function RoastScale({ roast, className = "" }: { roast: Roast; className?: string }) {
  const level = ROASTS.indexOf(roast);
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex gap-[3px]" aria-hidden="true">
        {ROASTS.map((r, i) => (
          <span
            key={r}
            className="h-2 w-5 rounded-full border border-ink"
            style={{ background: i <= level ? `var(--roast-${ROASTS[level]})` : "transparent" }}
          />
        ))}
      </span>
      <span className="text-sm text-ink-soft">{ROAST_LABEL[roast]} roast</span>
    </span>
  );
}
