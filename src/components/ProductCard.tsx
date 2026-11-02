import Link from "next/link";
import type { Product } from "@/data/products";
import { cardLine, formatPrice, listJoin } from "@/lib/format";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product: p, priority = false }: { product: Product; priority?: boolean }) {
  const soldOut = p.stock <= 0;
  return (
    <article className="group relative flex flex-col">
      <div className="relative">
        <ProductImage
          product={p}
          priority={priority}
          className={soldOut ? "opacity-55 grayscale-[40%]" : ""}
          imageClassName="transition-transform duration-300 ease-out group-hover:scale-[1.04]"
        />
        {/* Outside the faded picture so the badge keeps full contrast. */}
        {soldOut && <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">Out of stock</span>}
      </div>
      <p className="label mt-4">{cardLine(p)}</p>
      <h3 className="mt-1.5 min-w-0 break-words text-lg leading-snug sm:text-xl">
        <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 group-hover:underline focus-visible:underline">
          {p.name}
        </Link>
      </h3>
      {p.flavourNotes.length > 0 && <p className="mt-1 text-[0.95rem] text-ink-soft">{listJoin(p.flavourNotes)}</p>}
      <p className="mt-2 font-semibold tabular-nums">{formatPrice(p.pricePence)}</p>
    </article>
  );
}
