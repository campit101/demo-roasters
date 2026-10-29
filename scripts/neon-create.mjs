// One-off: creates a Neon project and stores its connection strings without printing them.
// Usage: node scripts/neon-create.mjs <name> <region-id> <org-id> <local|vercel-production>
//   local             -> writes DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED to .env.local
//   vercel-production -> stores both on Vercel Production only (never on this laptop)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [name, region, org, target] = process.argv.slice(2);
if (!name || !region || !org || !["local", "vercel-production"].includes(target ?? "")) {
  console.error("Usage: node scripts/neon-create.mjs <name> <region-id> <org-id> <local|vercel-production>");
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const created = spawnSync(
  npx,
  ["--yes", "neonctl@8.2.0", "projects", "create", "--name", name, "--region-id", region, "--org-id", org, "--output", "json"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (created.status !== 0) {
  // Error text from Neon holds no secrets.
  console.error(`Neon refused: ${(created.stderr || created.stdout).trim().slice(0, 600)}`);
  process.exit(1);
}

const out = JSON.parse(created.stdout);
const uri = out.connection_uris?.[0];
if (!uri) throw new Error("Neon returned no connection string");
const direct = new URL(uri.connection_uri);
const pooled = new URL(uri.connection_uri);
pooled.hostname = uri.connection_parameters.pooler_host;
const values = { DATABASE_URL: pooled.toString(), DATABASE_URL_UNPOOLED: direct.toString() };

if (target === "local") {
  const file = ".env.local";
  let lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean) : [];
  for (const [key, value] of Object.entries(values)) {
    lines = lines.filter((l) => !l.startsWith(`${key}=`));
    lines.push(`${key}=${value}`);
  }
  writeFileSync(file, `${lines.join("\n")}\n`);
} else {
  for (const [key, value] of Object.entries(values)) {
    const r = spawnSync(
      npx,
      ["--yes", "vercel@63.1.2", "env", "add", key, "production", "--sensitive", "--force", "--yes"],
      { input: value, encoding: "utf8", shell: process.platform === "win32" },
    );
    if (r.status !== 0) {
      console.error(`Could not save ${key} on Vercel: ${(r.stderr || "").trim().slice(0, 300)}`);
      process.exit(1);
    }
  }
}

console.log(JSON.stringify({
  project_id: out.project.id,
  name: out.project.name,
  region: out.project.region_id,
  pg_version: out.project.pg_version,
  stored: target === "local" ? ".env.local" : "Vercel Production",
}));
