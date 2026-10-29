// Generate one round 3 photo by slug (or a home page scene by its name, e.g. "hero").
// Usage: node scripts/gen-one.ts <slug|scene> <seed> [flux2pro|klein|zimage]
import { generatePhoto, type PhotoModel } from "./generate-photo.ts";
import { jobs, LIFESTYLE } from "./photo-prompts.ts";
const [name, seed = "7", model = "flux2pro"] = process.argv.slice(2);
const product = jobs().find((j) => j.file === `${name}.png`);
const scene = LIFESTYLE.find((j) => j.file === `${name}.png`);
if (!product && !scene) throw new Error(`No prompt for ${name}`);
if (product) await generatePhoto(product.file, Number(seed), product.prompt, model as PhotoModel, { dir: "photo-source/r3" });
else await generatePhoto(scene!.file, Number(seed), scene!.prompt, model as PhotoModel, { dir: "photo-source/r3/lifestyle", width: scene!.width, height: scene!.height });
console.log(`saved ${name}`);
