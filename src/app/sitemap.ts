import type { MetadataRoute } from "next";
import { CATEGORY_PAGES } from "@/config/categories";
import { siteUrl } from "@/config/site";
import { listCatalogue } from "@/db/catalogue";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = ["", "/about", "/privacy", "/terms", ...CATEGORY_PAGES.map((c) => `/shop/${c.slug}`)];
  const products = (await listCatalogue()).map((p) => `/products/${p.slug}`);
  return [...pages, ...products].map((path) => ({ url: `${base}${path}` }));
}
