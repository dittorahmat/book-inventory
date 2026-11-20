/**
 * Skrip sinkronisasi migrasi D1 otomatis (idempoten).
 * Membaca seluruh file drizzle/00*.sql secara berurutan, mengecek tabel tracking migrasi `_d1_migrations`,
 * dan mengeksekusi migrasi yang belum terpasang di remote D1 via runner kanonik db-d1-exec.
 * Mendukung migrasi multi-database sesuai CANONICAL_D1_TARGETS (§0.30).
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { resolveD1Targets, type D1DatabaseTarget } from "../src/server/lib/d1-targets";

export const DRIZZLE_DIR = process.env.DRIZZLE_DIR || "./drizzle";

export interface MigrationPlan {
  totalFiles: number;
  appliedCount: number;
  pending: string[];
}

export interface MultiDatabaseMigrationPlan {
  targets: Array<MigrationPlan & { database: string; env?: string }>;
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

export function execD1Command(sqlCmd: string, dbName?: string, dbEnv?: string): string {
  const envVars: NodeJS.ProcessEnv = { ...process.env };
  if (dbName) envVars.D1_DATABASE = dbName;
  if (dbEnv) envVars.D1_ENV = dbEnv;

  const result = spawnSync(
    "bun",
    ["scripts/db-d1-exec.ts", `--command=${sqlCmd}`, "--json"],
    {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: envVars,
    }
  );

  if (result.status !== 0) {
    throw new Error(`D1 command failed on ${dbName ?? "default"}: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

export function execD1File(filePath: string, dbName?: string, dbEnv?: string): void {
  const envVars: NodeJS.ProcessEnv = { ...process.env };
  if (dbName) envVars.D1_DATABASE = dbName;
  if (dbEnv) envVars.D1_ENV = dbEnv;

  const result = spawnSync(
    "bun",
    ["scripts/db-d1-exec.ts", filePath],
    {
      stdio: "inherit",
      env: envVars,
    }
  );

  if (result.status !== 0) {
    throw new Error(`Gagal menerapkan file migrasi ${filePath} ke remote D1 ${dbName ?? "default"}`);
  }
}

export async function migrateSingleDatabase(
  target: D1DatabaseTarget,
  options?: {
    drizzleDir?: string;
    commandRunner?: (sql: string, target: D1DatabaseTarget) => string;
    fileRunner?: (path: string, target: D1DatabaseTarget) => void;
  }
): Promise<MigrationPlan & { database: string; env?: string }> {
  const dir = options?.drizzleDir || DRIZZLE_DIR;
  const runCmd = options?.commandRunner
    ? (sql: string) => options.commandRunner!(sql, target)
    : (sql: string) => execD1Command(sql, target.name, target.env);
  const runFile = options?.fileRunner
    ? (path: string) => options.fileRunner!(path, target)
    : (path: string) => execD1File(path, target.name, target.env);

  console.log(`\n[d1-auto-migrate] === Memeriksa target database: ${target.name} (${target.description}) ===`);
  console.log(`[d1-auto-migrate] Menyiapkan tabel tracking migrasi di remote ${target.name}...`);
  runCmd("CREATE TABLE IF NOT EXISTS _d1_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");

  const rawTracking = runCmd("SELECT id FROM _d1_migrations;");
  let appliedIds: Set<string>;
  try {
    appliedIds = parseAppliedMigrations(rawTracking);
  } catch (err: any) {
    throw new Error(`Gagal membaca tabel _d1_migrations dari remote D1 (${target.name}): ${err.message}`);
  }

  const migrationFiles = readdirSync(dir)
    .filter((f) => /^0\d{3}_.*\.sql$/.test(f))
    .sort();

  console.log(`[d1-auto-migrate] Menemukan ${migrationFiles.length} file migrasi di ${dir} untuk ${target.name}.`);

  // Cold-start baseline guard: jika _d1_migrations kosong tapi database sudah punya tabel bisnis
  // (misal tabel books / book_items), lakukan inisialisasi baseline seluruh migrasi eksis
  if (appliedIds.size === 0) {
    const rawTables = runCmd("SELECT name FROM sqlite_master WHERE type='table' AND name='books';");
    const hasExistingTables = rawTables.includes('"books"');
    if (hasExistingTables) {
      console.log(`[d1-auto-migrate] Database eksis terdeteksi di ${target.name}. Melakukan baseline seluruh migrasi awal...`);
      for (const file of migrationFiles) {
        const safeId = sanitizeMigrationId(file);
        runCmd(`INSERT OR IGNORE INTO _d1_migrations (id, applied_at) VALUES ('${safeId}', datetime('now'));`);
        appliedIds.add(file);
      }
      console.log(`[d1-auto-migrate] Berhasil mem-baseline ${migrationFiles.length} migrasi awal di ${target.name}.`);
    }
  }

  const pending = computePendingMigrations(migrationFiles, appliedIds);

  if (pending.length === 0) {
    console.log(`[d1-auto-migrate] Seluruh migrasi D1 di ${target.name} sudah teraplikasi (up-to-date).`);
    return {
      database: target.name,
      env: target.env,
      totalFiles: migrationFiles.length,
      appliedCount: appliedIds.size,
      pending: [],
    };
  }

  console.log(`[d1-auto-migrate] Ada ${pending.length} migrasi tertunda di ${target.name}: ${pending.join(", ")}`);

  for (const file of pending) {
    const safeId = sanitizeMigrationId(file);
    const filePath = join(dir, file);
    console.log(`\n[d1-auto-migrate] [${target.name}] Menerapkan migrasi: ${file}...`);
    runFile(filePath);

    runCmd(`INSERT INTO _d1_migrations (id, applied_at) VALUES ('${safeId}', datetime('now'));`);
    console.log(`[d1-auto-migrate] [${target.name}] Selesai menerapkan ${file}.`);
  }

  console.log(`\n[d1-auto-migrate] Seluruh migrasi berhasil diterapkan ke remote ${target.name}!`);
  return {
    database: target.name,
    env: target.env,
    totalFiles: migrationFiles.length,
    appliedCount: appliedIds.size + pending.length,
    pending,
  };
}

export async function runAutoMigrate(options?: {
  drizzleDir?: string;
  dbName?: string;
  commandRunner?: (sql: string, target?: D1DatabaseTarget) => string;
  fileRunner?: (path: string, target?: D1DatabaseTarget) => void;
}): Promise<MigrationPlan & { targets?: MultiDatabaseMigrationPlan["targets"] }> {
  const customDb = options?.dbName || process.env.D1_DATABASE;
  const customEnv = process.env.D1_ENV;
  const targets = resolveD1Targets(customDb, customEnv);

  console.log(`[d1-auto-migrate] Memulai sinkronisasi otomatis untuk ${targets.length} database D1...`);

  const results: Array<MigrationPlan & { database: string; env?: string }> = [];

  for (const target of targets) {
    const res = await migrateSingleDatabase(target, {
      drizzleDir: options?.drizzleDir,
      commandRunner: options?.commandRunner ? (sql) => options.commandRunner!(sql, target) : undefined,
      fileRunner: options?.fileRunner ? (path) => options.fileRunner!(path, target) : undefined,
    });
    results.push(res);
  }

  const primaryResult = results[0] ?? {
    totalFiles: 0,
    appliedCount: 0,
    pending: [],
  };

  return {
    totalFiles: primaryResult.totalFiles,
    appliedCount: primaryResult.appliedCount,
    pending: results.flatMap((r) => r.pending),
    targets: results,
  };
}

if (import.meta.main) {
  runAutoMigrate().catch((err) => {
    console.error("\n[d1-auto-migrate ERROR]", err.message || err);
    process.exit(1);
  });
}
