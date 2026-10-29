import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_BANNER, GRINDS, LIMITS, NEON } from "@/config/shop";

describe("vercel.json", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    framework?: string;
    regions?: string[];
    git?: { deploymentEnabled?: boolean };
    crons?: { path: string; schedule: string }[];
  };

  it("builds as Next.js (the project was created before the code, so Vercel cannot guess)", () => {
    expect(config.framework).toBe("nextjs");
  });

  it("never deploys on git push (deploys happen only through the CLI)", () => {
    expect(config.git?.deploymentEnabled).toBe(false);
  });

  it("runs functions in London, next to the Neon database", () => {
    expect(config.regions).toEqual(["lhr1"]);
  });

  it("runs the nightly job once a day (the most Vercel Hobby allows)", () => {
    expect(config.crons).toEqual([{ path: "/api/cron/nightly", schedule: "0 3 * * *" }]);
  });
});

describe(".vercelignore", () => {
  it("never uploads local secrets", () => {
    const lines = readFileSync(".vercelignore", "utf8").split(/\r?\n/);
    expect(lines).toContain(".env*");
  });
});

describe("shop config", () => {
  it("shows the exact demo banner wording", () => {
    expect(DEMO_BANNER).toBe("Demo store: test payments only, nothing is sold");
  });

  it("keeps every limit a positive whole number", () => {
    for (const [name, value] of Object.entries(LIMITS)) {
      expect(Number.isInteger(value) && value > 0, name).toBe(true);
    }
  });

  it("keeps the test and live databases apart", () => {
    expect(NEON.test.endpoint).not.toBe(NEON.live.endpoint);
    expect(NEON.region).toBe("aws-eu-west-2");
  });
});

describe("grind choices", () => {
  it("are the same in the shop config and the database check", () => {
    const sql = readFileSync("drizzle/0001_order_item_grind.sql", "utf8");
    const listed = /in \(([^)]*)\)/.exec(sql)![1]!.split(",").map((s) => s.trim().replace(/'/g, ""));
    expect(listed).toEqual([...GRINDS]);
  });
});
