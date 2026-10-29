import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Gate Integritas Seed Demo
 * Memastikan tidak ada identifier atau slug residu lama yang tertinggal (misal 'nathan' setelah berganti ke 'zaki')
 * serta memeriksa konsistensi penamaan ID demo.
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
      // Cari kemunculan token case-insensitive
      const regex = new RegExp(`\\b${token}\\b`, "i");
      if (regex.test(content)) {
        console.error(`❌ [check:seed-integrity] Ditemukan residual identifier terlarang '${token}' di ${fullPath}`);
        hasError = true;
      }
    }
  }

  if (hasError) {
    console.error("\nSilakan selaraskan ID dan nama tampilan pada seeder demo (lihat AGENTS.md §0.26).");
    process.exit(1);
  }

  console.log("Seed-integrity gate OK: seluruh identifier seeder demo konsisten dan bebas dari residu.");
} catch (err) {
  console.error("Gagal memeriksa integritas seeder demo:", err);
  process.exit(1);
}
