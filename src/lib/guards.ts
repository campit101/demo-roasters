// Relative import with extension so plain `node scripts/*.ts` can load this file too.
import { NEON } from "../config/shop.ts";

const TEST_KEY = /^(sk|rk|pk)_test_[A-Za-z0-9]+$/;

/** Returns the key only if it is a Stripe test (sandbox) key. Live mode is never allowed on this project. */
export function assertTestStripeKey(key: string | undefined): string {
  if (key === undefined) throw new Error("Stripe key is missing");
  if (!TEST_KEY.test(key)) throw new Error("Refusing a Stripe key that is not a test key");
  return key;
}

const NEON_HOST = /^(ep-[a-z0-9-]+?)(-pooler)?\.[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech$/;

/** Throws unless the connection string points at the test database. Every script that writes data calls this. */
export function assertTestDatabaseUrl(url: string | undefined): string {
  if (url === undefined || url === "") throw new Error("Database connection string is missing");
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("Database connection string is not a valid URL");
  }
  const endpoint = NEON_HOST.exec(host)?.[1];
  if (endpoint === NEON.live.endpoint) throw new Error("Refusing to touch the live database");
  if (endpoint !== NEON.test.endpoint) throw new Error("Refusing: not the test database");
  return url;
}
