// Better Auth on the server (T6): email and password only, no emails ever sent, no IP addresses kept.
// There is no public /api/auth endpoint: every sign-up, sign-in and deletion goes through the server actions in
// ./actions.ts, which apply the per-connection limits first. Created lazily so builds without a database still work.
import "server-only";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { ACCOUNTS } from "@/config/shop";
import { siteUrl } from "@/config/site";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return betterAuth({
    appName: "Demo Roasters",
    baseURL: siteUrl(),
    secret,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
      minPasswordLength: ACCOUNTS.passwordMinLength,
      maxPasswordLength: ACCOUNTS.passwordMaxLength,
    },
    session: { expiresIn: ACCOUNTS.sessionDays * 24 * 60 * 60 },
    user: {
      // Sign-up can never set these (input: false); roles are set only by user id with a one-off script.
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "customer" },
        isDemo: { type: "boolean", input: false, defaultValue: false },
      },
      deleteUser: {
        enabled: true,
        beforeDelete: async (u) => {
          if ((u as { isDemo?: boolean }).isDemo) throw new APIError("FORBIDDEN", { message: "Demo accounts cannot be deleted." });
        },
      },
    },
    // Sessions keep no browser or device details (Better Auth would store the user agent).
    databaseHooks: {
      session: { create: { before: async (session) => ({ data: { ...session, userAgent: null, ipAddress: null } }) } },
    },
    // Limits are ours (hashed keys); Better Auth's own limiter would store raw IP addresses.
    rateLimit: { enabled: false },
    // Session cookie: httpOnly and SameSite=Lax by default; always Secure on Vercel (local tests run on plain http).
    advanced: { ipAddress: { disableIpTracking: true }, useSecureCookies: process.env.VERCEL === "1" || undefined },
    plugins: [nextCookies()],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;
export const getAuth = () => (auth ??= createAuth());
