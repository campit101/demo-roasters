// Saves Cam's Hugging Face read token as HF_TOKEN in .env.local (git-ignored), without showing it on
// screen or putting it on a command line. Only the local photo script uses it (free ZeroGPU quota);
// it is never sent to Vercel or written anywhere else.
// Usage: npm run setup:hf
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const NAME = "HF_TOKEN";
const LOOKS_RIGHT = (key) => key.startsWith("hf_") && key.length >= 30 && !/\s/.test(key);

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = (text) => {
  if (!muted) rl.output.write(text);
};

rl.question("Paste the Hugging Face token (nothing will appear while you paste), then press Enter: ", (answer) => {
  rl.output.write("\n");
  rl.close();
  const key = answer.trim();
  if (!LOOKS_RIGHT(key)) {
    console.error("That does not look like a full Hugging Face token (it starts with hf_). Nothing was saved. Copy it again and rerun.");
    process.exit(1);
  }
  const file = ".env.local";
  const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith(`${NAME}=`)) : [];
  lines.push(`${NAME}=${key}`);
  writeFileSync(file, `${lines.join("\n")}\n`);
  console.log("Saved in .env.local only. Tell the developer: token added.");
});
muted = true;
