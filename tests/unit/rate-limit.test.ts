import { describe, expect, it } from "vitest";
import { clientAddress, limitKey, windowStart } from "@/lib/rate-limit";

describe("rate limit keys", () => {
  it("reads the first forwarded address, then x-real-ip, else unknown", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientAddress(new Headers())).toBe("unknown");
    // One home or phone holds a whole IPv6 /64, so the limits count it as one connection.
    expect(clientAddress(new Headers({ "x-forwarded-for": "2001:db8:abcd:12::1" }))).toBe("2001:db8:abcd:12::/64");
  });

  it("never contains the address, and differs by action and salt", () => {
    const k = limitKey("search", "203.0.113.7", "salt-a");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain("203.0.113.7");
    expect(limitKey("sign-in", "203.0.113.7", "salt-a")).not.toBe(k);
    expect(limitKey("search", "203.0.113.7", "salt-b")).not.toBe(k);
  });

  it("refuses to work without a salt", () => {
    expect(() => limitKey("search", "203.0.113.7", "")).toThrow(/IP_HASH_SALT/);
  });

  it("puts times in fixed windows", () => {
    expect(windowStart(new Date("2026-10-25T12:34:56Z"), 60).toISOString()).toBe("2026-10-25T12:34:00.000Z");
    expect(windowStart(new Date("2026-10-25T12:34:56Z"), 3600).toISOString()).toBe("2026-10-25T12:00:00.000Z");
  });
});
