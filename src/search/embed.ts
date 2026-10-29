// Free meaning model: gte-small (MIT), run on our own server with ONNX Runtime. 384 numbers per text.
// The model files ship inside the build (scripts/fetch-model.ts); nothing is downloaded at run time.
import { join } from "node:path";
import type { Product } from "@/data/products";

export const EMBEDDING_MODEL = "Xenova/gte-small";

type Extractor = (text: string | string[], options: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;

let extractor: Promise<Extractor> | undefined;

function load(): Promise<Extractor> {
  extractor ??= (async () => {
    const { env, pipeline } = await import("@huggingface/transformers");
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = join(process.cwd(), "models");
    env.useFSCache = false;
    return (await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" })) as unknown as Extractor;
  })();
  return extractor;
}

/** One normalised meaning vector per text (cosine similarity is then a plain dot product). */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const run = await load();
  const out = await run(texts, { pooling: "mean", normalize: true });
  const width = out.dims[out.dims.length - 1]!;
  return texts.map((_, i) => Array.from(out.data.subarray(i * width, (i + 1) * width)));
}

/** The text a product's meaning vector is built from. */
export function productEmbeddingText(p: Pick<Product, "name" | "category" | "roast" | "caffeine" | "flavourNotes" | "brewMethods" | "description">): string {
  const facts = [
    p.category === "beans" ? "coffee beans" : p.category === "gear" ? "brewing equipment" : "gift bundle",
    p.roast ? `${p.roast} roast` : "",
    p.caffeine === "decaf" ? "decaf" : "",
    p.flavourNotes.length ? `tastes of ${p.flavourNotes.join(", ")}` : "",
    p.brewMethods.length ? `for ${p.brewMethods.join(", ")}` : "",
  ].filter(Boolean);
  return `${p.name}. ${facts.join("; ")}. ${p.description}`;
}

export function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}
