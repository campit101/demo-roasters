// Connects the search flow (run.ts) to the real world for the search page: the visitor's connection (hashed,
// never stored raw), the shared limiter and database, the bundled meaning model with a small vector cache,
// and search_events written after the page has been sent.
import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { getDb } from "@/db/client";
import { clientAddress, consume } from "@/lib/rate-limit";
import { findCandidates } from "./candidates";
import { embed } from "./embed";
import { recordSearchEvent } from "./events";
import { searchAllowance } from "./limits";
import type { SearchRequest } from "./request";
import { runSearch, type SearchOutcome } from "./run";
import { createVectorCache } from "./vector-cache";

const embedCached = createVectorCache(async (text) => (await embed([text]))[0]!);

export async function searchForPage(request: SearchRequest): Promise<SearchOutcome> {
  if (!request.q) return { status: "idle" };
  const db = getDb();
  const address = clientAddress(await headers());
  return runSearch(request, {
    allowance: () => searchAllowance({ address, consume: (key, limit, now) => consume(db, key, limit, now) }),
    embed: embedCached,
    candidates: (filters, vector) => findCandidates(db, filters, vector),
    record: (event) => after(() => recordSearchEvent(db, event)),
    onError: (error) => console.error("Meaning model unavailable; this search used keywords only.", error),
  });
}
