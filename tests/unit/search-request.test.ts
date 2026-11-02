import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, parseQuery } from "@/search/parse";
import { applyDrops, chipId, readSearchRequest, searchHref } from "@/search/request";

describe("readSearchRequest (the search page address)", () => {
  it("reads the query, tidying spaces", () => {
    expect(readSearchRequest({ q: "  decaf   under £12 " })).toEqual({ q: "decaf under £12", drops: [] });
  });

  it("treats a missing or repeated q safely", () => {
    expect(readSearchRequest({})).toEqual({ q: "", drops: [] });
    expect(readSearchRequest({ q: ["fruity", "nutty"] }).q).toBe("fruity");
  });

  it("cuts very long queries to the parser's limit", () => {
    expect(readSearchRequest({ q: "a".repeat(500) }).q).toHaveLength(MAX_QUERY_LENGTH);
  });

  it("keeps well-formed chip removals and ignores tampered ones", () => {
    const { drops } = readSearchRequest({ q: "x", drop: ["caffeine:decaf", "price", "origin:Costa Rica", "<script>", "method:" + "x".repeat(60), "price"] });
    expect(drops).toEqual(["caffeine:decaf", "price", "origin:Costa Rica"]);
  });

  it("accepts a single removal as a plain string", () => {
    expect(readSearchRequest({ q: "x", drop: "roast:dark" }).drops).toEqual(["roast:dark"]);
  });
});

describe("chips and removing them", () => {
  it("gives each chip a stable id", () => {
    const { chips } = parseQuery("decaf espresso under £12");
    expect(chips.map(chipId)).toEqual(["caffeine:decaf", "method:espresso", "price"]);
  });

  it("removing a chip removes exactly that filter and keeps the rest", () => {
    const parsed = parseQuery("decaf espresso under £12");
    const { parsed: after, dropped } = applyDrops(parsed, ["caffeine:decaf"]);
    expect(dropped.map((c) => c.label)).toEqual(["Decaf"]);
    expect(after.filters).toEqual({ methods: ["espresso"], maxPricePence: 1200 });
    expect(after.chips.map((c) => c.label)).toEqual(["Espresso", "Under £12.00"]);
  });

  it("removing the price chip removes both ends of a range", () => {
    const { parsed } = applyDrops(parseQuery("medium roast £10 to £11"), ["price"]);
    expect(parsed.filters).toEqual({ roasts: ["medium"] });
  });

  it("removing one value of a multi-value filter keeps the others", () => {
    const { parsed } = applyDrops(parseQuery("filter coffee"), ["method:batch-brew"]);
    expect(parsed.filters.methods).toEqual(["pour-over"]);
  });

  it("ignores removals for chips the query does not have", () => {
    const parsed = parseQuery("fruity light roast");
    const result = applyDrops(parsed, ["caffeine:decaf", "price"]);
    expect(result.parsed).toEqual(parsed);
    expect(result.dropped).toEqual([]);
  });

  it("never changes the meaning words", () => {
    const parsed = parseQuery("chocolatey decaf");
    expect(applyDrops(parsed, ["caffeine:decaf"]).parsed.terms).toEqual(parsed.terms);
  });
});

describe("searchHref", () => {
  it("builds the results address with any removals", () => {
    expect(searchHref("decaf under £12")).toBe("/search?q=decaf+under+%C2%A312");
    expect(searchHref("filter coffee", ["method:batch-brew", "price"])).toBe("/search?q=filter+coffee&drop=method%3Abatch-brew&drop=price");
    expect(searchHref("")).toBe("/search");
  });

  it("round-trips through readSearchRequest", () => {
    const href = searchHref("costa rica light", ["origin:Costa Rica"]);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(readSearchRequest({ q: params.get("q") ?? undefined, drop: params.getAll("drop") })).toEqual({ q: "costa rica light", drops: ["origin:Costa Rica"] });
  });
});
