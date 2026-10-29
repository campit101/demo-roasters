export interface SearchCase {
  id: string;
  query: string;
  acceptable: readonly string[];
  mustBeFirst?: string;
  maxPricePence?: number;
  minPricePence?: number;
  why: string;
}
