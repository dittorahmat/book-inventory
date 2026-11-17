/**
 * Skrip sinkronisasi migrasi D1 otomatis (idempoten).
 * Membaca seluruh file drizzle/00*.sql secara berurutan, mengecek tabel tracking migrasi `_d1_migrations`,
 * dan mengeksekusi migrasi yang belum terpasang di remote D1.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const D1_DATABASE = process.env.D1_DATABASE || "book-inventory-db";
const DRIZZLE_DIR = process.env.DRIZZLE_DIR || "./drizzle";

function execD1Command(sqlCmd: string): string {
  const result = spawnSync(
    "bun",
    ["run", "wrangler", "d1", "execute", D1_DATABASE, "--remote", `--command=${sqlCmd}`, "--json"],
    {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  if (result.status !== 0) {
    throw new Error(`D1 command failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function execD1File(filePath: string): void {
  const result = spawnSync(
    "bun",
    ["run", "wrangler", "d1", "execute", D1_DATABASE, "--remote", `--file=${filePath}`],
    {
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    throw new Error(`Gagal menerapkan file migrasi ${filePath} ke remote D1`);
  }
}

async function main() {
  console.log(`[d1-auto-migrate] Menyiapkan tabel tracking migrasi di remote ${D1_DATABASE}...`);
  execD1Command(
    "CREATE TABLE IF NOT EXISTS _d1_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);"
  );

  const rawTracking = execD1Command("SELECT id FROM _d1_migrations;");
  let appliedIds = new Set<string>();
  try {
    const parsed = JSON.parse(rawTracking);
    const rows = parsed[0]?.results || [];
    appliedIds = new Set(rows.map((r: { id: string }) => r.id));
  } catch (err) {
    console.warn("[d1-auto-migrate] Gagal mengurai baris _d1_migrations, berasumsi kosong:", err);
  }

  const migrationFiles = readdirSync(DRIZZLE_DIR)
    .filter((f) => /^0\d{3}_.*\.sql$/.test(f))
    .sort();

  console.log(`[d1-auto-migrate] Menemukan ${migrationFiles.length} file migrasi di ${DRIZZLE_DIR}.`);

  const pending = migrationFiles.filter((f) => !appliedIds.has(f));

  if (pending.length === 0) {
    console.log("[d1-auto-migrate] Seluruh migrasi D1 sudah teraplikasi (up-to-date).");
    return;
  }

  console.log(`[d1-auto-migrate] Ada ${pending.length} migrasi tertunda: ${pending.join(", ")}`);

  for (const file of pending) {
    const filePath = join(DRIZZLE_DIR, file);
    console.log(`\n[d1-auto-migrate] Menerapkan migrasi: ${file}...`);
    execD1File(filePath);

    const now = new Date().toISOString();
    execD1Command(
      `INSERT INTO _d1_migrations (id, applied_at) VALUES ('${file}', '${now}');`
    );
    console.log(`[d1-auto-migrate] Selesai menerapkan ${file}.`);
  }

  console.log("\n[d1-auto-migrate] Seluruh migrasi berhasil diterapkan ke remote D1!");
}

main().catch((err) => {
  console.error("\n[d1-auto-migrate ERROR]", err.message || err);
  process.exit(1);
});
