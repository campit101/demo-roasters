// Example searches offered in the header panel and on an empty search page. Plain ideas, not a "popular"
// list (nothing is tracked), and none is one of the locked test queries.
export const SEARCH_EXAMPLES = [
  "fruity coffee for filter",
  "decaf under £12",
  "chocolatey espresso",
  "something for cold brew",
  "smooth and nutty",
  "gift under £30",
] as const;

/** The results address for a query typed into a box (removed chips start afresh). Safe for browser code. */
export const searchUrl = (q: string) => `/search?${new URLSearchParams({ q })}`;
