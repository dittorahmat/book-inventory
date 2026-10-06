// Isolasi database test: setiap `bun test` berjalan di atas file SQLite
// sementara (bukan data/inventory.db), sehingga junk test (supplier,
// buku, sekolah timestamped) tidak pernah mencemari DB dev maupun D1.
// Dimuat via preload (lihat bunfig.toml [test]) sebelum test file mana pun.
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = "./data";
const TMP_PREFIX = ".tmp-test-";
const tmpPath = join(DATA_DIR, `${TMP_PREFIX}${process.pid}.db`);

// Bersihkan sisa temp run sebelumnya (mis. run yang dibatalkan paksa).
for (const entry of readdirSync(DATA_DIR)) {
  if (entry.startsWith(TMP_PREFIX) && entry.endsWith(".db") && entry !== `${TMP_PREFIX}${process.pid}.db`) {
    try {
      unlinkSync(join(DATA_DIR, entry));
    } catch {
      // Abaikan file terkunci; run berikutnya akan mencoba lagi.
    }
  }
}
if (existsSync(tmpPath)) unlinkSync(tmpPath);

// Bangun skema dari file migrasi drizzle (urutan jurnal), tanpa data.
const migrationFiles = readdirSync("./drizzle")
  .filter((f) => /^0\d{3}_.*\.sql$/.test(f))
  .sort();
if (migrationFiles.length === 0) {
  throw new Error("Isolasi test gagal: tidak ada file migrasi di drizzle/.");
}

const setupDb = new Database(tmpPath);
try {
  for (const file of migrationFiles) {
    const sql = readFileSync(join("./drizzle", file), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) setupDb.run(trimmed);
    }
  }
} finally {
  setupDb.close();
}

// Arahkan seluruh test ke DB sementara SEBELUM modul src/db diimpor.
process.env.DB_PATH = tmpPath;

// Baseline seed (5 sekolah/gudang + katalog) agar test yang bergantung
// pada data dasar (mis. gudang logistik) tetap deterministik.
const { runIdempotentSeed } = await import("../src/server/seed");
await runIdempotentSeed();
