// Generates every missing product photo and home page scene, one at a time, retrying politely on errors.
// Round 3 photos go to photo-source/r3/ (products) and photo-source/r3/lifestyle/ (scenes); existing files are skipped.
// Usage: node scripts/generate-all-photos.ts [seed] [flux2pro|klein|zimage]
import { existsSync } from "node:fs";
import { generatePhoto, type PhotoModel } from "./generate-photo.ts";
import { jobs, LIFESTYLE } from "./photo-prompts.ts";

const seed = Number(process.argv[2] ?? "7");
const model = (process.argv[3] ?? "flux2pro") as PhotoModel;
const todo = [
  ...jobs().map((j) => ({ ...j, dir: "photo-source/r3", width: 1120, height: 1392 })),
  ...LIFESTYLE.map((j) => ({ ...j, dir: "photo-source/r3/lifestyle" })),
].filter((j) => !existsSync(`${j.dir}/${j.file}`));
console.log(`${todo.length} photos to make`);
for (const [i, job] of todo.entries()) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await generatePhoto(job.file, seed, job.prompt, model, { dir: job.dir, width: job.width, height: job.height });
      console.log(`[${i + 1}/${todo.length}] saved ${job.dir}/${job.file}`);
      break;
    } catch (e) {
      console.log(`[${i + 1}/${todo.length}] ${job.file} attempt ${attempt} failed: ${(e as Error).message.slice(0, 200)}`);
      if (attempt === 3) break;
      await new Promise((r) => setTimeout(r, 20_000 * attempt));
    }
  }
}
console.log("finished");
