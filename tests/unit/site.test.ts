import { describe, expect, it } from "vitest";
import { indexingAllowed } from "@/config/site";

describe("indexingAllowed", () => {
  it("keeps search engines out by default", () => {
    expect(indexingAllowed({})).toBe(false);
  });

  it.each(["false", "TRUE", "1", "yes", " true"])("stays off for %j", (value) => {
    expect(indexingAllowed({ ALLOW_INDEXING: value })).toBe(false);
  });

  it("turns on only for exactly true", () => {
    expect(indexingAllowed({ ALLOW_INDEXING: "true" })).toBe(true);
  });
});
