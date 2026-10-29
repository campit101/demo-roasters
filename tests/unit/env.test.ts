import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnvLocal } from "../../scripts/env";

describe("loadEnvLocal", () => {
  it("never loads Vercel's markers from .env.local, so a pulled file cannot switch off the test-database guard", () => {
    const file = join(mkdtempSync(join(tmpdir(), "env-")), ".env.local");
    writeFileSync(file, 'VERCEL="1"\nVERCEL_ENV="production"\nVERCEL_OIDC_TOKEN="abc"\nDATABASE_URL="postgres://test"\nSET="file"\n');
    const env: Record<string, string | undefined> = { SET: "already" };
    loadEnvLocal(file, env);
    expect(env).toEqual({ SET: "already", VERCEL_OIDC_TOKEN: "abc", DATABASE_URL: "postgres://test" });
  });
});
