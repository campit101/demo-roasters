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

  it("accepts the test project's direct and pooled hosts", () => {
    for (const host of [`${NEON.test.endpoint}.c-2.eu-west-2.aws.neon.tech`, `${NEON.test.endpoint}-pooler.c-2.eu-west-2.aws.neon.tech`]) {
      expect(() => assertTestDatabaseUrl(test(host))).not.toThrow();
    }
  });

  it("refuses the live project", () => {
    expect(() => assertTestDatabaseUrl(test(`${NEON.live.endpoint}-pooler.c-2.eu-west-2.aws.neon.tech`))).toThrow(
      /live|test/i,
    );
  });

  it("refuses a look-alike host that only contains the test endpoint", () => {
    expect(() => assertTestDatabaseUrl(test(`evil-${NEON.test.endpoint}.example.com`))).toThrow();
    expect(() => assertTestDatabaseUrl(test(`${NEON.test.endpoint}.example.com`))).toThrow();
  });

  it("refuses missing or malformed strings", () => {
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(/missing/i);
    expect(() => assertTestDatabaseUrl("not a url")).toThrow();
  });
});
