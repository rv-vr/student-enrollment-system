import { drizzle as drizzleClient } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";

// Lightweight helper to obtain a Drizzle client from the Cloudflare D1 binding
export function getDbFromBindings(
  bindings: { DB: D1Database } | { env: { DB: D1Database } },
) {
  const db: D1Database =
    "DB" in bindings ? bindings.DB : (bindings.env.DB as D1Database);
  return drizzleClient(db);
}

export type DrizzleClient = ReturnType<typeof drizzleClient>;
