import type { NextConfig } from "next";
import { indexingAllowed } from "./src/config/site";

// Only the Linux x64 engine (45 MB): the package holds every operating system (301 MB), and
// exclusions do not apply to files listed here, so each part is named exactly.
const MODEL_FILES = [
  "./models/**/*",
  "./node_modules/onnxruntime-node/package.json",
  "./node_modules/onnxruntime-node/dist/**/*",
  "./node_modules/onnxruntime-node/lib/**/*",
  "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*",
  "./node_modules/onnxruntime-common/**/*",
];

const nextConfig: NextConfig = {
  // Allows separate build folders (verify builds into .next-verify so it never fights a dev server).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // The meaning model runs on ONNX Runtime's native library: load it from node_modules, never bundle it.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  // Ship the fingerprint-checked model files with the server, and only the Linux x64 runtime
  // (the full package holds every operating system and would break Vercel's 250 MB function limit).
  // transformers.js loads ONNX Runtime with a runtime import that file tracing cannot follow (found 23 Oct:
  // "Cannot find module 'onnxruntime-node'" on the first preview), so the runtime is listed by hand.
  outputFileTracingIncludes: {
    // Every route that runs the meaning model: the search page (T5) and API routes.
    "/search": MODEL_FILES,
    "/api/**": MODEL_FILES,
    // Saving a product's description in the dashboard re-embeds it with the same model.
    "/admin/**": MODEL_FILES,
  },
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
      "./node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**",
      "./node_modules/onnxruntime-web/**",
    ],
  },
  async headers() {
    // Content-Security-Policy (T11): everything from this site only. Inline scripts stay allowed because the pages are
    // pre-built (a per-request nonce would stop caching) and Next and the theme script inline small scripts; nothing
    // a visitor types is ever rendered as HTML. Checkout leaves for Stripe by plain navigation, which this does not limit.
    // The dev server alone needs eval for fast refresh.
    const dev = process.env.NODE_ENV === "development";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self'${dev ? " ws:" : ""}`,
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "worker-src 'self' blob:",
    ].join("; ");
    const security = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    // Search engines stay out until the owner's approval (T12) sets ALLOW_INDEXING=true and the site is redeployed.
    const robots = indexingAllowed(process.env) ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [{ source: "/:path*", headers: [...security, ...robots] }];
  },
};

export default nextConfig;
