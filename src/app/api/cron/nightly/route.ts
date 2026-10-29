// Vercel cron calls this once a day (vercel.json) with "Authorization: Bearer <CRON_SECRET>". Anyone else is refused.
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { CATALOGUE_TAG } from "@/db/catalogue";
import { getDb } from "@/db/client";
import { runNightly } from "@/lib/nightly";

function authorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorised(req.headers.get("authorization"), process.env.CRON_SECRET)) return new Response("Unauthorised", { status: 401 });
  const { report, failed } = await runNightly(getDb());
  revalidateTag(CATALOGUE_TAG, "max");
  const ok = Object.keys(failed).length === 0;
  if (!ok) console.error("Nightly steps failed:", failed);
  // A failed step shows as an error in Vercel's cron log; the steps after it have still run.
  return Response.json({ ok, report, failed }, { status: ok ? 200 : 500 });
}
