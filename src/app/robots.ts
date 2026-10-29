import type { MetadataRoute } from "next";
import { indexingAllowed, siteUrl } from "@/config/site";

// Search engines stay out entirely until the owner's approval sets ALLOW_INDEXING=true (T12). After that,
// search results, accounts, admin and API addresses stay out.
export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed(process.env)) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/search", "/account", "/admin", "/order/", "/api/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
