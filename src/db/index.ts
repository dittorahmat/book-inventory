import * as schema from "./schema";
import type { D1Database } from "@cloudflare/workers-types";

// Dual-runtime escape hatch: BunSQLite (lokal) vs D1 (Workers) tidak punya
// tipe union yang kompatibel di semua call-site, jadi satu `any` terpusat
// di sini (bukan tersebar di service/route).
export type AppDatabase = any;

export interface D1Env {
  DB?: D1Database;
}

let activeDb: AppDatabase | null = null;
let standaloneDb: AppDatabase | null = null;

export async function getDatabase(env?: D1Env): Promise<AppDatabase> {
  // 1. Check if running inside Cloudflare Workers with D1 binding
  if (env && env.DB) {
    const { drizzle } = await import("drizzle-orm/d1");
    const d1Db = drizzle(env.DB as any, { schema });
    activeDb = d1Db;
    return d1Db;
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
    activeDb = standaloneDb;
  }

  return standaloneDb;
}

// Initialize standalone instance synchronously if Bun environment is present
const isBun = typeof (globalThis as Record<string, unknown>).Bun !== "undefined";
if (isBun && !standaloneDb) {
  try {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const dbPath = process.env.DB_PATH || "./data/inventory.db";
    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    standaloneDb = drizzle(sqlite, { schema });
    activeDb = standaloneDb;
  } catch {
    // Graceful fallback when bundler runs under Cloudflare / browser stub
  }
}

// Export dynamic proxy to delegate queries to either active D1 instance or standalone SQLite
export const db: AppDatabase = new Proxy({} as any, {
  get(_target, prop) {
    const target = activeDb || standaloneDb;
    if (!target) {
      throw new Error("Database not initialized. Ensure getDatabase(env) is invoked.");
    }
    const val = (target as any)[prop];
    return typeof val === "function" ? val.bind(target) : val;
  },
});

export { schema };
