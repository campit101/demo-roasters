// Repeated searches reuse their meaning vector instead of running the model again. Held in this server
// instance's memory only, keyed by a hash of the text (the text itself is not kept), most recent first.
import { createHash } from "node:crypto";

export function createVectorCache(embedOne: (text: string) => Promise<number[]>, max = 300) {
  const cache = new Map<string, Promise<number[]>>();
  return (text: string): Promise<number[]> => {
    const key = createHash("sha256").update(text).digest("hex");
    let vector = cache.get(key);
    if (vector) cache.delete(key);
    else {
      vector = embedOne(text);
      vector.catch(() => cache.delete(key));
    }
    cache.set(key, vector);
    if (cache.size > max) cache.delete(cache.keys().next().value!);
    return vector;
  };
}
