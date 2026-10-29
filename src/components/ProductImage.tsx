import Image from "next/image";
import type { Product } from "@/data/products";
import { backdropOf } from "@/lib/taste";

/**
 * A product photo on its taste-colour block (round 3, DESIGN.md). Photos are AI-generated (FLUX.2 [pro]) on that
 * same colour and fitted to it exactly by scripts/process-photos.ts, so photo and block join without a seam.
 */
export function ProductImage({
  product,
  priority = false,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  className = "",
  imageClassName = "",
  alt,
}: {
  product: Pick<Product, "slug" | "name" | "category" | "flavourNotes">;
  priority?: boolean;
  sizes?: string;
  className?: string;
  imageClassName?: string;
  alt?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-[var(--radius-card)] ${className}`} style={{ background: backdropOf(product).colour }}>
      <Image
        src={`/products/${product.slug}.webp`}
        alt={alt ?? ""}
        width={800}
        height={1000}
        sizes={sizes}
        priority={priority}
        unoptimized
        className={`h-auto w-full ${imageClassName}`}
      />
    </div>
  );
}
