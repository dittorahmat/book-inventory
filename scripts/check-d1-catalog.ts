import { execSync } from "node:child_process";

// Master tables yang wajib memiliki baris data di remote production D1
const REQUIRED_MASTER_TABLES: Array<{ table: string; minCount: number; label: string }> = [
  { table: "schools", minCount: 1, label: "Master Sekolah" },
  { table: "books", minCount: 1, label: "Master Buku" },
  { table: "book_packages", minCount: 1, label: "Master Paket Buku" },
  { table: "uniform_variants", minCount: 1, label: "Master Varian Seragam" },
  { table: "uniform_packages", minCount: 1, label: "Master Paket Seragam" },
  { table: "uniform_package_bom", minCount: 1, label: "BOM Paket Seragam" },
  { table: "uniform_stock", minCount: 50, label: "Saldo Stok Seragam" },
];

async function checkRemoteD1Catalog() {
  console.log("Memeriksa kelengkapan master data katalog di Cloudflare D1 remote...");
  
  // D1 membatasi compound terms, gunakan query terpisah per tabel
  const violations: string[] = [];
  try {
    for (const req of REQUIRED_MASTER_TABLES) {
      const raw = execSync(
        `bun run wrangler d1 execute book-inventory-db --remote --json --command="SELECT COUNT(*) as cnt FROM ${req.table};"`,
        { encoding: "utf-8" }
      );
      const parsed = JSON.parse(raw);
      const count = (parsed[0]?.results?.[0] as { cnt: number } | undefined)?.cnt ?? 0;

      if (count < req.minCount) {
        violations.push(`- ${req.label} (${req.table}): ditemukan ${count} baris (wajib minimal ${req.minCount})`);
      } else {
        console.log(`✓ ${req.label} (${req.table}): ${count} baris`);
      }
    }

    if (violations.length > 0) {
      console.error("\n[D1 CATALOG OUT-OF-SYNC] Master data remote D1 belum lengkap/kosong:");
      violations.forEach((v) => console.error(v));
      console.error("\nJalankan skrip sinkronisasi data katalog D1 sebelum deploy/merge!");
      process.exit(1);
    }

    console.log("\nSeluruh master data katalog di remote D1 terverifikasi lengkap.");
  } catch (err) {
    console.error("Gagal memeriksa remote D1:", err);
    process.exit(1);
  }
}

checkRemoteD1Catalog();
