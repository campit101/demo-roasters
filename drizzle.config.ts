import { defineConfig } from "drizzle-kit";

// Migrations are generated from src/db/schema.ts into drizzle/ and applied with scripts/migrate.mjs,
// which refuses anything but the test database unless the live database is explicitly allowed.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
