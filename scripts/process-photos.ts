// Turns round 3 generated photos into site images.
//   photo-source/r3/<slug>.png            -> public/products/<slug>.webp  (800 by 1000; backdrop nudged to the
//                                            product's exact taste colour from src/lib/taste.ts, so photo and card join)
//   photo-source/r3/lifestyle/<name>.png  -> public/lifestyle/<name>.webp (longest side 1600)
// Usage: node scripts/process-photos.ts [name ...]
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import sharp from "sharp";
import { PRODUCTS } from "../src/data/products.ts";
import { backdropOf } from "../src/lib/taste.ts";

const only = process.argv.slice(2);
const wanted = (f: string) => only.length === 0 || only.some((s) => f.startsWith(s));
mkdirSync("public/products", { recursive: true });
mkdirSync("public/lifestyle", { recursive: true });

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

async function cornerColour(input: sharp.Sharp): Promise<number[]> {
  const { data, info } = await input.clone().resize(80, 100, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sums = [0, 0, 0];
  let n = 0;
  // Top corners and the upper sides only: the bottom holds the product's shadow.
  for (const [x0, y0] of [
    [0, 0],
    [72, 0],
    [0, 30],
    [72, 30],
  ]) {
    for (let y = y0; y < y0 + 8; y++)
      for (let x = x0; x < x0 + 8; x++) {
        const i = (y * info.width + x) * 3;
        for (let c = 0; c < 3; c++) sums[c]! += data[i + c]!;
        n++;
      }
  }
  return sums.map((s) => s / n);
}

if (existsSync("photo-source/r3")) {
  for (const file of readdirSync("photo-source/r3").filter((f) => /\.png$/i.test(f) && wanted(f))) {
    const slug = file.replace(/\.png$/i, "");
    const p = PRODUCTS.find((x) => x.slug === slug);
    if (!p) continue;
    const target = hex(backdropOf(p).colour);
    const base = sharp(`photo-source/r3/${file}`).resize(800, 1000, { fit: "cover", position: "centre" });
    const bg = await cornerColour(base);
    // Only backdrop pixels change: pixels whose colour mix matches the backdrop's (its shadows included) are scaled
    // onto the card colour. The white pouch, black print and products differ in colour mix and are left exactly as
    // generated (a whole-picture shift tinted the white pouches mint or pink, found 25 Oct).
    const { data, info } = await base.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const now = bg;
    const nowSum = now[0]! + now[1]! + now[2]!;
    const rest = target.map((t, c) => t / now[c]!);
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      const sum = r + g + b || 1;
      const d = Math.hypot(r / sum - now[0]! / nowSum, g / sum - now[1]! / nowSum, b / sum - now[2]! / nowSum);
      const bright = sum / nowSum;
      const w = Math.max(0, Math.min(1, 1.5 - d / 0.03)) * (bright > 0.3 && bright < 1.3 ? 1 : 0);
      if (w === 0) continue;
      for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(data[i + c]! * (1 + w * (rest[c]! - 1))));
    }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 84 }).toFile(`public/products/${slug}.webp`);
    const after = await cornerColour(sharp(`public/products/${slug}.webp`));
    const off = Math.max(...target.map((t, c) => Math.abs(t - after[c]!)));
    console.log(`public/products/${slug}.webp  backdrop rgb(${bg.map(Math.round).join(", ")}) -> ${backdropOf(p).colour}${off > 6 ? `  WARNING: still ${Math.round(off)} levels off` : ""}`);
  }
  const dir = "photo-source/r3/lifestyle";
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => /\.png$/i.test(f) && wanted(f))) {
      const name = file.replace(/\.png$/i, "");
      await sharp(`${dir}/${file}`).resize(1600, 1600, { fit: "inside" }).webp({ quality: 80 }).toFile(`public/lifestyle/${name}.webp`);
      console.log(`public/lifestyle/${name}.webp`);
    }
  }
} else console.log("No photo-source/r3 folder.");
