import type { AppDatabase } from "../../db";

/** Konteks seed: satu instance DB + timestamp yang dipakai seluruh modul. */
export interface SeedContext {
  db: AppDatabase;
  now: string;
}
