import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Search evaluation runs (reports, not gates). Kept out of `npm test`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/search/**/*.eval.ts"],
  },
});
