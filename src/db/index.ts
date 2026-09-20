import * as schema from "./schema";

export type AppDatabase = any;

let standaloneDb: AppDatabase | null = null;

export async function getDatabase(env?: any): Promise<AppDatabase> {
  // 1. Check if running inside Cloudflare Workers with D1 binding
  if (env && env.DB) {
    const { drizzle } = await import("drizzle-orm/d1");
    return drizzle(env.DB, { schema });
  }

  // 2. Otherwise, running on Bun / VPS / On-Premise standalone SQLite
  if (!standaloneDb) {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const dbPath = process.env.DB_PATH || "./data/inventory.db";

    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(dbPath), { recursive: true });

    const sqlite = new Database(dbPath);
    standaloneDb = drizzle(sqlite, { schema });
  }

  return standaloneDb;
}

// Initialize standalone instance synchronously if Bun environment is present
const isBun = typeof (globalThis as any).Bun !== "undefined";
if (isBun && !standaloneDb) {
  const { Database } = await import("bun:sqlite");
  const { drizzle } = await import("drizzle-orm/bun-sqlite");
  const dbPath = process.env.DB_PATH || "./data/inventory.db";
  const { mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  standaloneDb = drizzle(sqlite, { schema });
}

export const db: AppDatabase = standaloneDb || ({} as any);

export { schema };
