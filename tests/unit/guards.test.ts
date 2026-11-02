import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertTestDatabaseUrl, assertTestStripeKey } from "@/lib/guards";
import { NEON } from "@/config/shop";

describe("assertTestStripeKey", () => {
  it.each(["sk_test_abc123", "rk_test_abc123", "pk_test_abc123"])("accepts the test key %s", (key) => {
    expect(assertTestStripeKey(key)).toBe(key);
  });

  it.each(["sk_live_abc123", "rk_live_abc123", "pk_live_abc123", "", "test_sk_abc", " sk_test_abc"])(
    "refuses %j",
    (key) => {
      expect(() => assertTestStripeKey(key)).toThrow(/test/i);
    },
  );

  it("refuses a missing key", () => {
    expect(() => assertTestStripeKey(undefined)).toThrow(/missing/i);
  });
});

describe("assertTestDatabaseUrl", () => {
  const test = (host: string) => `postgresql://user:pw@${host}/neondb?sslmode=require`;
  // Made-up endpoints with their fingerprints, so this test never names the real databases.
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");
  const prints = { test: { endpointSha256: sha("ep-fake-test-123456") }, live: { endpointSha256: sha("ep-fake-live-654321") } };

  it("accepts the test project's direct and pooled hosts", () => {
    for (const host of ["ep-fake-test-123456.c-2.eu-west-2.aws.neon.tech", "ep-fake-test-123456-pooler.c-2.eu-west-2.aws.neon.tech"]) {
      expect(() => assertTestDatabaseUrl(test(host), prints)).not.toThrow();
    }
  });

  it("refuses the live project", () => {
    expect(() => assertTestDatabaseUrl(test("ep-fake-live-654321-pooler.c-2.eu-west-2.aws.neon.tech"), prints)).toThrow(/live/i);
  });

  it("refuses a look-alike host that only contains the test endpoint", () => {
    expect(() => assertTestDatabaseUrl(test("evil-ep-fake-test-123456.example.com"), prints)).toThrow();
    expect(() => assertTestDatabaseUrl(test("ep-fake-test-123456.example.com"), prints)).toThrow();
    expect(() => assertTestDatabaseUrl(test("ep-other-999999.c-2.eu-west-2.aws.neon.tech"), prints)).toThrow(/not the test/i);
  });

  it("stores fingerprints, never the endpoint names, for the real databases", () => {
    expect(NEON.test.endpointSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(NEON.live.endpointSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses missing or malformed strings", () => {
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(/missing/i);
    expect(() => assertTestDatabaseUrl("not a url")).toThrow();
  });
});
