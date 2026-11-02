import type { Category } from "@/data/products";

// Shoppers see these names and addresses; the database keeps the short category codes.
export const CATEGORY_PAGES: readonly { category: Category; slug: string; name: string; blurb: string }[] = [
  { category: "beans", slug: "coffee", name: "Coffee", blurb: "Whole-bean coffee roasted light to dark, single origins and blends, decaf included." },
  { category: "gear", slug: "brewing-gear", name: "Brewing gear", blurb: "Kettles, drippers, presses and grinders for brewing at home." },
  { category: "bundle", slug: "gift-sets", name: "Gift sets", blurb: "Coffee and kit put together, ready to give." },
];

export const categoryBySlug = (slug: string) => CATEGORY_PAGES.find((c) => c.slug === slug);
export const categoryPage = (category: Category) => CATEGORY_PAGES.find((c) => c.category === category)!;
