// Starts the secrets wizard with Git Bash, even when bash is not on PATH (normal on Windows).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const candidates = [
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
];
const bash = process.platform === "win32" ? candidates.find((p) => existsSync(p)) : "bash";

if (!bash) {
  console.error("Could not find Git Bash. Tell the developer: 'the wizard says Git Bash is missing'.");
  process.exit(1);
}

const result = spawnSync(bash, ["scripts/setup-secrets.sh"], { stdio: "inherit" });
process.exit(result.status ?? 1);
