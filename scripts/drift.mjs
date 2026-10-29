// Read-only drift check: prints what git, GitHub CI, Vercel, Neon and Stripe say right now,
// so HANDOFF.md can be compared against reality at the start of every session.
// Usage: npm run drift
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const win = process.platform === "win32";
const npx = win ? "npx.cmd" : "npx";

function sh(command, args, options = {}) {
  const r = spawnSync(command, args, { encoding: "utf8", shell: win && command.endsWith(".cmd"), ...options });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function section(title, lines) {
  console.log(`\n## ${title}`);
  for (const line of lines) console.log(`- ${line}`);
}

function envLocal() {
  if (!existsSync(".env.local")) return {};
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
  );
}

// git
const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out;
const head = sh("git", ["log", "-1", "--format=%h %s"]).out;
const dirty = sh("git", ["status", "--porcelain"]).out.split("\n").filter(Boolean).length;
sh("git", ["fetch", "--quiet", "origin"]);
const aheadBehind = sh("git", ["rev-list", "--left-right", "--count", `origin/main...HEAD`]).out.replace(/\s+/, " behind, ahead ");
section("git", [`branch ${branch}, HEAD ${head}`, `${dirty} uncommitted file(s)`, `against origin/main: ${aheadBehind}`]);

// GitHub CI
const runs = sh("gh", ["run", "list", "--limit", "3", "--json", "headBranch,headSha,status,conclusion,createdAt,displayTitle"]);
section(
  "GitHub CI (latest 3 runs)",
  !runs.ok
    ? [`could not read: ${runs.err.slice(0, 200)}`]
    : runs.out === "[]"
      ? ["none yet"]
      : JSON.parse(runs.out).map((r) => `${r.createdAt.slice(0, 16)} ${r.headBranch} ${r.headSha.slice(0, 7)} ${r.status}/${r.conclusion || "-"}: ${r.displayTitle}`),
);

// Vercel
const deployments = sh(npx, ["--yes", "vercel@63.1.2", "ls", "demo-roasters"]);
const lines = (deployments.out + "\n" + deployments.err).split("\n").filter((l) => /https:\/\//.test(l)).slice(0, 5);
section("Vercel deployments (latest 5)", lines.length ? lines.map((l) => l.trim().replace(/\s+/g, " ")) : ["none"]);

// Neon
const projects = sh(npx, ["--yes", "neonctl@8.2.0", "projects", "list", "--org-id", "org-blue-credit-29191553", "--output", "json"]);
let neonLines;
try {
  const parsed = JSON.parse(projects.out);
  neonLines = (parsed.projects ?? parsed).map((p) => `${p.name} ${p.id} ${p.region_id}`);
} catch {
  neonLines = [`could not read: ${(projects.err || projects.out).slice(0, 200)}`];
}
section("Neon projects", neonLines);

// Stripe (sandbox only; the key is never printed)
const key = envLocal().STRIPE_SECRET_KEY;
let stripeLines;
if (!key || !/^(sk|rk)_test_/.test(key)) {
  stripeLines = ["no test key in .env.local"];
} else {
  const res = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${key}` } });
  const account = await res.json();
  stripeLines = res.ok
    ? [`sandbox "${account.settings?.dashboard?.display_name}", ${account.country}, ${account.default_currency}`]
    : [`error: ${account.error?.message}`];
}
section("Stripe", stripeLines);

// HANDOFF ideas marked to build before something
const handoff = existsSync("HANDOFF.md") ? readFileSync("HANDOFF.md", "utf8") : "";
// Only real idea rows, not the command table that describes this check (false alarm found 23 Oct).
const pending = handoff.split("\n").filter((l) => /build before/i.test(l) && !/adopted|done|npm run drift/i.test(l));
section("Ideas marked 'build before'", pending.length ? pending : ["none"]);
