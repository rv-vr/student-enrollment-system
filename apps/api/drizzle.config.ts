// apps/api/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

// 🕵️ Find the hidden Wrangler local D1 SQLite file
function getLocalD1Path() {
  const basePath = path.resolve(
    ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
  );

  if (fs.existsSync(basePath)) {
    const files = fs.readdirSync(basePath, { recursive: true }) as string[];
    const sqliteFile = files.find((f) => f.endsWith(".sqlite"));
    if (sqliteFile) {
      return path.join(basePath, sqliteFile);
    }
  }
  return "";
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // ⚡ Dynamically load the path to let Drizzle Studio connect perfectly!
    url: getLocalD1Path(),
  },
});
