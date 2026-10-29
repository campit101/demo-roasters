// Site-wide switches read at build time. Changing one means a redeploy.

export const SITE_NAME = "Demo Roasters";
/** Privacy contact (Cam's choice, 23 Oct 2026). */
export const CONTACT_EMAIL = "polisher.help@gmail.com";
export const OWNER_NAME = "Cam";

/** The site's own address: the production alias when set, else Vercel's address for this deployment, else local. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Search engines may index the site only when ALLOW_INDEXING is exactly "true" (set after the owner's approval). */
export function indexingAllowed(env: Record<string, string | undefined>): boolean {
  return env.ALLOW_INDEXING === "true";
}
