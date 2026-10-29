import { describe, expect, it, vi } from "vitest";
import { LIMITS } from "@/config/shop";
import { limitKey, windowStart, type Limit } from "@/lib/rate-limit";
import { ipGroup, londonWallClock, searchAllowance, type Consume } from "@/search/limits";

describe("ipGroup (what counts as one connection for search)", () => {
  it("keeps an IPv4 address whole", () => {
    expect(ipGroup("203.0.113.7")).toBe("203.0.113.7");
  });

  it("groups IPv6 by its first 64 bits, however it is written", () => {
    expect(ipGroup("2001:db8:abcd:12::1")).toBe("2001:db8:abcd:12::/64");
    expect(ipGroup("2001:0db8:abcd:0012:ffff:0:0:9")).toBe("2001:db8:abcd:12::/64");
    expect(ipGroup("2001:DB8:ABCD:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
    expect(ipGroup("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });

  it("reads an IPv4 address wrapped in IPv6", () => {
    expect(ipGroup("::ffff:198.51.100.4")).toBe("198.51.100.4");
  });

  it("leaves the shared 'unknown' group alone", () => {
    expect(ipGroup("unknown")).toBe("unknown");
    expect(ipGroup("")).toBe("unknown");
  });
});

describe("londonWallClock (so the daily ceiling resets at midnight in London)", () => {
  const day = (iso: string) => windowStart(londonWallClock(new Date(iso)), 86_400).toISOString().slice(0, 10);

  it("puts late-evening summer searches on the next London day", () => {
    expect(day("2026-07-01T22:59:00Z")).toBe("2026-07-01");
    expect(day("2026-07-01T23:30:00Z")).toBe("2026-07-02");
  });

  it("matches UTC in winter", () => {
    expect(day("2026-12-01T23:59:00Z")).toBe("2026-12-01");
    expect(day("2026-12-02T00:00:00Z")).toBe("2026-12-02");
  });

  it("follows the clock change (clocks went back at 01:00 UTC on 25 Oct 2026)", () => {
    expect(day("2026-10-24T23:30:00Z")).toBe("2026-10-25");
    expect(day("2026-10-25T12:00:00Z")).toBe("2026-10-25");
  });
});

describe("searchAllowance", () => {
  const now = new Date("2026-10-25T13:04:30Z");
  const salt = "test-salt";
  const answers = (connection: boolean, day: boolean, share = true): Consume =>
    vi.fn(async (key: string) => {
      const allowed = key === limitKey("search", "203.0.113.7", salt) ? connection : key === limitKey("search-day", "203.0.113.7", salt) ? share : day;
      return { allowed, retryAfterSeconds: 30 };
    });

  it("uses the limits from the shop config, unchanged", () => {
    expect(LIMITS.searchesPerMinutePerConnection).toBe(20);
    expect(LIMITS.searchesPerDay).toBe(2000);
    expect(LIMITS.meaningSearchesPerDayPerConnection).toBe(100);
  });

  it("checks this connection per minute, then its daily share, then the shared daily ceiling on London days", async () => {
    const consume = answers(true, true);
    expect(await searchAllowance({ address: "203.0.113.7", salt, now, consume })).toEqual({ allowed: true, meaning: true });
    expect(consume).toHaveBeenNthCalledWith(1, limitKey("search", "203.0.113.7", salt), { max: 20, windowSeconds: 60 } satisfies Limit, now);
    expect(consume).toHaveBeenNthCalledWith(2, limitKey("search-day", "203.0.113.7", salt), { max: 100, windowSeconds: 86_400 } satisfies Limit, londonWallClock(now));
    expect(consume).toHaveBeenNthCalledWith(3, limitKey("search-day", "everyone", salt), { max: 2000, windowSeconds: 86_400 } satisfies Limit, londonWallClock(now));
  });

  it("falls back to keywords for one connection past its daily share, without using up everyone's day", async () => {
    const consume = answers(true, true, false);
    expect(await searchAllowance({ address: "203.0.113.7", salt, now, consume })).toEqual({ allowed: true, meaning: false });
    expect(consume).toHaveBeenCalledTimes(2);
  });

  it("refuses when this connection is over its limit, without counting it towards the day", async () => {
    const consume = answers(false, true);
    expect(await searchAllowance({ address: "203.0.113.7", salt, now, consume })).toEqual({ allowed: false, retryAfterSeconds: 30 });
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it("falls back to keywords only once the shared daily ceiling is passed", async () => {
    expect(await searchAllowance({ address: "203.0.113.7", salt, now, consume: answers(true, false) })).toEqual({ allowed: true, meaning: false });
  });

  it("counts a whole IPv6 /64 as one connection", async () => {
    const consume = vi.fn<Consume>(async () => ({ allowed: true, retryAfterSeconds: 1 }));
    await searchAllowance({ address: "2001:db8:abcd:12::1", salt, now, consume });
    await searchAllowance({ address: "2001:db8:abcd:12:9:9:9:9", salt, now, consume });
    expect(consume.mock.calls[0]![0]).toBe(consume.mock.calls[3]![0]);
  });
});
