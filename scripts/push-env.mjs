// Copies chosen values from .env.local to Vercel without printing them.
// Production gets the shared secrets; Preview also gets the TEST database, never the live one.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);

const plan = [
  ...["STRIPE_SECRET_KEY", "IP_HASH_SALT", "CRON_SECRET", "BETTER_AUTH_SECRET"].flatMap((k) => [
    [k, "production"],
    [k, "preview"],
  ]),
  ["DATABASE_URL", "preview"],
  ["DATABASE_URL_UNPOOLED", "preview"],
];

if (!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? "")) {
  console.error("Refusing: STRIPE_SECRET_KEY is not a test key.");
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
let failed = 0;
for (const [key, target] of plan) {
  if (!env[key]) {
    console.error(`missing in .env.local: ${key}`);
    failed++;
    continue;
  }
  const r = spawnSync(npx, ["--yes", "vercel@63.1.2", "env", "add", key, target, "--sensitive", "--force", "--yes"], {
    input: env[key],
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  console.log(`${r.status === 0 ? "saved " : "FAILED"} ${key} (${target})`);
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
