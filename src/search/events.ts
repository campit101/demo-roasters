// Writes one row to search_events per search: result count, time taken, which layers ran and the cost
// (always 0 on the free path). There is no column for the search text, so it can never be stored.
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SearchEvent } from "./run";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = NodePgDatabase<any>;

export async function recordSearchEvent(db: Db, event: SearchEvent): Promise<void> {
  await db.execute(sql`
    insert into search_events (result_count, duration_ms, layer, cost_micropence)
    values (${event.resultCount}, ${event.durationMs}, ${event.layer}, ${event.costMicropence})`);
}
