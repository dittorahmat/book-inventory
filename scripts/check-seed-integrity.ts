import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { isTestSeedValue } from "../src/server/lib/validators";

/**
 * Gate Integritas Seed Demo & Database Lokal
 * Memastikan tidak ada identifier atau slug residu lama yang tertinggal (misal 'nathan' setelah berganti ke 'zaki'),
 * serta memeriksa konsistensi penamaan ID demo dan ketiadaan sekolah sampah di database lokal.
 */

const SEED_DIR = "src/server/seed-demo";
const FORBIDDEN_TOKENS = ["nathan", "nathaniel"];

let hasError = false;

try {
  const files = readdirSync(SEED_DIR).filter((f) => f.endsWith(".ts"));

  for (const file of files) {
    const fullPath = join(SEED_DIR, file);
    const content = readFileSync(fullPath, "utf-8");

    for (const token of FORBIDDEN_TOKENS) {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      if (regex.test(content)) {
        console.error(`❌ [check:seed-integrity] Ditemukan residual identifier terlarang '${token}' di ${fullPath}`);
        hasError = true;
      }
    }
  }

  // Verifikasi database lokal inventory.db bebas dari sekolah sampah/anomali
  const localDbPath = process.env.DB_PATH || "./data/inventory.db";
  if (existsSync(localDbPath)) {
    const db = new Database(localDbPath, { readonly: true });
    try {
      const schools = db.query("SELECT id, name FROM schools").all() as Array<{ id: string; name: string }>;
      const junk = schools.filter((s) => isTestSeedValue(s.id) || isTestSeedValue(s.name));
      if (junk.length > 0) {
        console.error(`❌ [check:seed-integrity] Ditemukan ${junk.length} record sekolah kotor/sampah di ${localDbPath}:`);
        for (const j of junk) {
          console.error(`   - ${j.id}: "${j.name}"`);
        }
        hasError = true;
      }
    } finally {
      db.close();
    }
  }

  if (hasError) {
    console.error("\nSilakan selaraskan ID dan nama tampilan pada seeder demo atau bersihkan DB lokal (lihat docs/rules/database-d1.md §0.26).");
    process.exit(1);
  }

  console.log("Seed-integrity gate OK: seeder demo konsisten dan DB lokal bebas residu data sampah.");
} catch (err) {
  console.error("Gagal memeriksa integritas seeder demo / DB lokal:", err);
  process.exit(1);
}
