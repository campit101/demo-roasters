// Generates one product photo and saves it into photo-source/.
// Default model: FLUX.2 [pro] (Black Forest Labs) through Vercel AI Gateway, paid from the team's free monthly
// AI Gateway credit (no daily limit, no card on file, so it cannot charge; measured $0.045 a photo, 23 Oct 2026).
// BFL's developer terms (revised 4 Aug 2026): the user owns outputs and may use them commercially.
// Older models, kept for regenerating the first 10 photos: FLUX 3 Image Klein and Z-Image Turbo through free
// Hugging Face Spaces (daily ZeroGPU limit; Klein's FLUX Kommunity licence allows commercial outputs below US$5m revenue).
// Usage: node scripts/generate-photo.ts <file-name.png> <seed> "<prompt>" [flux2pro|klein|zimage]
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvLocal } from "./env.ts";

export type PhotoModel = "flux2pro" | "klein" | "zimage";

const SPACES = {
  klein: {
    space: "https://black-forest-labs-flux-3-image-klein.hf.space",
    data: (prompt: string, seed: number) => [prompt, [], "Distilled (16 steps)", seed, false, 1120, 1392, 16, 1, false],
    url: (out: unknown[]) => (out[0] as { url: string }).url,
  },
  zimage: {
    space: "https://tongyi-mai-z-image-turbo.hf.space",
    data: (prompt: string, seed: number) => [prompt, "1120x1440 ( 7:9 )", seed, 8, 3, false, []],
    url: (out: unknown[]) => (out[0] as { image: { url: string } }[])[0]!.image.url,
  },
} as const;

// Cam's read-only Hugging Face token (from .env.local, never printed) raises the free daily GPU quota.
// Without it, calls run anonymously.
loadEnvLocal();
const hfAuth: Record<string, string> = process.env.HF_TOKEN ? { authorization: `Bearer ${process.env.HF_TOKEN}` } : {};

// AI Gateway accepts the project's short-lived Vercel OIDC token (about 12 hours). It is pulled into a temp file
// outside the repo, read and deleted at once, and only ever held in memory. Nothing is created in Cam's account.
// A token already in the environment (or .env.local) is used only while it has more than 10 minutes left.
const fresh = (token: string | undefined) => {
  try {
    const { exp } = JSON.parse(Buffer.from(token!.split(".")[1]!, "base64url").toString()) as { exp: number };
    return exp * 1000 > Date.now() + 10 * 60_000;
  } catch {
    return false;
  }
};
let gatewayToken: string | undefined = fresh(process.env.VERCEL_OIDC_TOKEN) ? process.env.VERCEL_OIDC_TOKEN : undefined;
export function oidcToken(): string {
  if (gatewayToken) return gatewayToken;
  const file = join(tmpdir(), `dr-oidc-${process.pid}.env`);
  try {
    spawnSync("npx", ["--yes", "vercel@63.1.2", "env", "pull", `"${file}"`, "--environment", "development", "--yes"], { shell: true, stdio: "ignore" });
    gatewayToken = /^VERCEL_OIDC_TOKEN="?([^"\r\n]+)"?/m.exec(readFileSync(file, "utf8"))?.[1];
  } finally {
    rmSync(file, { force: true });
  }
  if (!gatewayToken) throw new Error("Could not get a Vercel OIDC token (is the Vercel CLI signed in and the project linked?)");
  return gatewayToken;
}

async function viaGateway(seed: number, prompt: string, width = 1120, height = 1392): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch("https://ai-gateway.vercel.sh/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${oidcToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "bfl/flux-2-pro",
        prompt,
        n: 1,
        providerOptions: { blackForestLabs: { width, height, seed, outputFormat: "png" } },
      }),
    });
    // Free tier is rate limited per minute: wait as told (or back off) and try again, up to 5 times.
    if (r.status === 429 && attempt < 5) {
      const wait = Number(r.headers.get("retry-after")) || 2 ** attempt * 5;
      await new Promise((res) => setTimeout(res, wait * 1000));
      continue;
    }
    if (!r.ok) throw new Error(`AI Gateway refused: ${r.status} ${(await r.text()).slice(0, 300)}`);
    const { data } = (await r.json()) as { data: { b64_json: string }[] };
    return Buffer.from(data[0]!.b64_json, "base64");
  }
}

async function viaSpace(model: keyof typeof SPACES, seed: number, prompt: string): Promise<Buffer> {
  const m = SPACES[model];
  const start = await fetch(`${m.space}/gradio_api/call/generate`, {
    method: "POST",
    headers: { "content-type": "application/json", ...hfAuth },
    body: JSON.stringify({ data: m.data(prompt, seed) }),
  });
  if (!start.ok) throw new Error(`Space refused the request: ${start.status} ${(await start.text()).slice(0, 300)}`);
  const { event_id } = (await start.json()) as { event_id: string };
  const text = await (await fetch(`${m.space}/gradio_api/call/generate/${event_id}`, { headers: hfAuth })).text();
  const complete = /event: complete\ndata: (.*)/.exec(text);
  if (!complete) throw new Error(`No image: ${text.slice(-300).replace(/\s+/g, " ")}`);
  const image = await fetch(m.url(JSON.parse(complete[1]!) as unknown[]));
  if (!image.ok) throw new Error(`Download failed: ${image.status}`);
  return Buffer.from(await image.arrayBuffer());
}

/** Saves into photo-source/ (or opts.dir). Size applies to FLUX.2 [pro] only; the old Spaces have fixed sizes. */
export async function generatePhoto(
  file: string,
  seed: number,
  prompt: string,
  model: PhotoModel = "flux2pro",
  opts: { dir?: string; width?: number; height?: number } = {},
) {
  const image = model === "flux2pro" ? await viaGateway(seed, prompt, opts.width, opts.height) : await viaSpace(model, seed, prompt);
  const dir = opts.dir ?? "photo-source";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${file}`, image);
}

if (process.argv[1]?.endsWith("generate-photo.ts")) {
  const [file, seed, prompt, model = "flux2pro"] = process.argv.slice(2);
  if (!file || !seed || !prompt) throw new Error('Usage: node scripts/generate-photo.ts <file.png> <seed> "<prompt>" [flux2pro|klein|zimage]');
  await generatePhoto(file, Number(seed), prompt, model as PhotoModel);
  console.log(`saved photo-source/${file}`);
}
