// Downloads the free embedding model (gte-small, MIT licence, converted to ONNX by Xenova) at a pinned
// revision and checks every file against Hugging Face's own fingerprints before keeping it.
// Runs before each build (so the model ships inside the server bundle) and once locally.
// The app never downloads anything at run time.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const REPO = "Xenova/gte-small";
const REVISION = "5927d1727bb12db490052a1b33265ad78058de08";
const TARGET = join("models", REPO);

// Small files are checked by their git blob id, the large model file by its SHA-256 (both from the Hugging Face API, 23 Oct 2026).
const FILES: { path: string; size: number; gitBlob?: string; sha256?: string }[] = [
  { path: "config.json", size: 601, gitBlob: "d694838acebac863da0748e695545e84844b7e21" },
  { path: "special_tokens_map.json", size: 125, gitBlob: "a8b3208c2884c4efb86e49300fdd3dc877220cdf" },
  { path: "tokenizer.json", size: 711661, gitBlob: "c17ed520ed8438736732a54957a69306b8822215" },
  { path: "tokenizer_config.json", size: 557, gitBlob: "d8949bfcad15e0b2b95ce6f944446d7fc49125e9" },
  { path: "onnx/model_quantized.onnx", size: 34014426, sha256: "18dec105109b6004369799ca4761fb8fb413c64172c02147bcfac186b5c5f6cb" },
];

function matches(file: (typeof FILES)[number], bytes: Buffer): boolean {
  if (bytes.length !== file.size) return false;
  if (file.sha256) return createHash("sha256").update(bytes).digest("hex") === file.sha256;
  const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  return blob === file.gitBlob;
}

for (const file of FILES) {
  const dest = join(TARGET, file.path);
  if (existsSync(dest) && matches(file, readFileSync(dest))) continue;
  const url = `https://huggingface.co/${REPO}/resolve/${REVISION}/${file.path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${file.path}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!matches(file, bytes)) throw new Error(`Fingerprint mismatch for ${file.path}: refusing to use it`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(`${dest}.part`, bytes);
  renameSync(`${dest}.part`, dest);
  console.log(`fetched ${file.path} (${(bytes.length / 1e6).toFixed(1)} MB)`);
}
console.log(`Model ready at ${TARGET} (revision ${REVISION.slice(0, 7)}, all fingerprints checked).`);
