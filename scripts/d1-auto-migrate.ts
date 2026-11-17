/**
 * Skrip sinkronisasi migrasi D1 otomatis (idempoten).
 * Membaca seluruh file drizzle/00*.sql secara berurutan, mengecek tabel tracking migrasi `_d1_migrations`,
 * dan mengeksekusi migrasi yang belum terpasang di remote D1 via runner kanonik db-d1-exec.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const D1_DATABASE = process.env.D1_DATABASE || "book-inventory-db";
export const DRIZZLE_DIR = process.env.DRIZZLE_DIR || "./drizzle";

export interface MigrationPlan {
  totalFiles: number;
  appliedCount: number;
  pending: string[];
}

export function parseAppliedMigrations(rawJson: string): Set<string> {
  const parsed = JSON.parse(rawJson);
  const rows = parsed[0]?.results || [];
  return new Set(rows.map((r: { id: string }) => r.id).filter(Boolean));
}

export function computePendingMigrations(allFiles: string[], applied: Set<string>): string[] {
  return allFiles.filter((f) => !applied.has(f)).sort();
}

export function sanitizeMigrationId(filename: string): string {
  if (!/^0\d{3}_[a-zA-Z0-9_-]+\.sql$/.test(filename)) {
    throw new Error(`Nama file migrasi tidak valid atau tidak aman: ${filename}`);
  }
  return filename.replace(/'/g, "''");
}

export function execD1Command(sqlCmd: string, dbName: string = D1_DATABASE): string {
  const result = spawnSync(
    "bun",
    ["scripts/db-d1-exec.ts", `--command=${sqlCmd}`, "--json"],
    {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, D1_DATABASE: dbName },
    }
  );

  if (result.status !== 0) {
    throw new Error(`D1 command failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

export function execD1File(filePath: string, dbName: string = D1_DATABASE): void {
  const result = spawnSync(
    "bun",
    ["scripts/db-d1-exec.ts", filePath],
    {
      stdio: "inherit",
      env: { ...process.env, D1_DATABASE: dbName },
    }
  );

  if (result.status !== 0) {
    throw new Error(`Gagal menerapkan file migrasi ${filePath} ke remote D1`);
  }
}

export async function runAutoMigrate(options?: {
  drizzleDir?: string;
  dbName?: string;
  commandRunner?: (sql: string) => string;
  fileRunner?: (path: string) => void;
}): Promise<MigrationPlan> {
  const dir = options?.drizzleDir || DRIZZLE_DIR;
  const dbName = options?.dbName || D1_DATABASE;
  const runCmd = options?.commandRunner || ((sql: string) => execD1Command(sql, dbName));
  const runFile = options?.fileRunner || ((path: string) => execD1File(path, dbName));

  console.log(`[d1-auto-migrate] Menyiapkan tabel tracking migrasi di remote ${dbName}...`);
  runCmd("CREATE TABLE IF NOT EXISTS _d1_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");

  const rawTracking = runCmd("SELECT id FROM _d1_migrations;");
  let appliedIds: Set<string>;
  try {
    appliedIds = parseAppliedMigrations(rawTracking);
  } catch (err: any) {
    throw new Error(`Gagal membaca tabel _d1_migrations dari remote D1: ${err.message}`);
  }

  const migrationFiles = readdirSync(dir)
    .filter((f) => /^0\d{3}_.*\.sql$/.test(f))
    .sort();

  console.log(`[d1-auto-migrate] Menemukan ${migrationFiles.length} file migrasi di ${dir}.`);

  // Cold-start baseline guard: jika _d1_migrations kosong tapi database sudah punya tabel bisnis
  // (misal tabel books / book_items), lakukan inisialisasi baseline seluruh migrasi eksis
  if (appliedIds.size === 0) {
    const rawTables = runCmd("SELECT name FROM sqlite_master WHERE type='table' AND name='books';");
    const hasExistingTables = rawTables.includes('"books"');
    if (hasExistingTables) {
      console.log("[d1-auto-migrate] Database eksis terdeteksi. Melakukan baseline seluruh migrasi awal...");
      for (const file of migrationFiles) {
        const safeId = sanitizeMigrationId(file);
        runCmd(`INSERT OR IGNORE INTO _d1_migrations (id, applied_at) VALUES ('${safeId}', datetime('now'));`);
        appliedIds.add(file);
      }
      console.log(`[d1-auto-migrate] Berhasil mem-baseline ${migrationFiles.length} migrasi awal.`);
    }
  }

  const pending = computePendingMigrations(migrationFiles, appliedIds);

  if (pending.length === 0) {
    console.log("[d1-auto-migrate] Seluruh migrasi D1 sudah teraplikasi (up-to-date).");
    return {
      totalFiles: migrationFiles.length,
      appliedCount: appliedIds.size,
      pending: [],
    };
  }

  console.log(`[d1-auto-migrate] Ada ${pending.length} migrasi tertunda: ${pending.join(", ")}`);

  for (const file of pending) {
    const safeId = sanitizeMigrationId(file);
    const filePath = join(dir, file);
    console.log(`\n[d1-auto-migrate] Menerapkan migrasi: ${file}...`);
    runFile(filePath);

    runCmd(`INSERT INTO _d1_migrations (id, applied_at) VALUES ('${safeId}', datetime('now'));`);
    console.log(`[d1-auto-migrate] Selesai menerapkan ${file}.`);
  }

  console.log("\n[d1-auto-migrate] Seluruh migrasi berhasil diterapkan ke remote D1!");
  return {
    totalFiles: migrationFiles.length,
    appliedCount: appliedIds.size + pending.length,
    pending,
  };
}

if (import.meta.main) {
  runAutoMigrate().catch((err) => {
    console.error("\n[d1-auto-migrate ERROR]", err.message || err);
    process.exit(1);
  });
}
