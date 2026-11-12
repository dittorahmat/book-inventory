import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getUniformSizeChart } from "../src/lib/uniform-size-chart";

const outputPath = resolve("data/sql/sync-uniform-sizes-d1.sql");

async function main() {
  console.log("[generate-d1-sync] Menghasilkan SQL sinkronisasi D1...");
  const sqlLines: string[] = [];

  sqlLines.push("-- 1. Update nama paket seragam menjadi 'Paket Bahan Seragam Harian ...'");
  sqlLines.push("UPDATE uniform_packages SET name = REPLACE(name, 'Seragam Bahan Seragam Harian', 'Bahan Seragam Harian') WHERE name LIKE '%Seragam Bahan Seragam Harian%';");
  sqlLines.push("UPDATE uniform_packages SET name = REPLACE(name, 'Paket Seragam Lengkap ', 'Paket Bahan Seragam Harian ') WHERE name LIKE '%Paket Seragam Lengkap %';");
  sqlLines.push("UPDATE uniform_packages SET name = REPLACE(name, 'Paket Seragam ', 'Paket Bahan Seragam Harian ') WHERE name LIKE 'Paket Seragam %' AND name NOT LIKE 'Paket Bahan Seragam Harian%';");

  sqlLines.push("\n-- 2. Bersihkan item olahraga dari BOM paket seragam harian");
  sqlLines.push(
    "DELETE FROM uniform_package_bom WHERE variant_id IN (SELECT id FROM uniform_variants WHERE kind = 'olahraga');"
  );

  sqlLines.push("\n-- 3. Hapus ukuran lama varian olahraga yang ada di target database");
  sqlLines.push(
    "DELETE FROM uniform_sizes WHERE variant_id IN (SELECT id FROM uniform_variants WHERE kind = 'olahraga');"
  );

  sqlLines.push("\n-- 4. Masukkan ukuran hanya untuk varian olahraga yang memang ada di uniform_variants target");
  // Menggunakan subselect ke uniform_variants agar 100% aman Foreign Key
  for (const jenjang of ["tk", "sd", "smp", "sma"] as const) {
    const chart = getUniformSizeChart(jenjang);
    for (const entry of chart) {
      sqlLines.push(
        `INSERT OR REPLACE INTO uniform_sizes (id, variant_id, size, sort_order, created_at) ` +
        `SELECT 'usz-' || id || '-${entry.size.toLowerCase()}', id, '${entry.size}', ${entry.chartNumber}, datetime('now') ` +
        `FROM uniform_variants WHERE kind = 'olahraga' AND jenjang = '${jenjang}';`
      );
    }
  }

  writeFileSync(outputPath, sqlLines.join("\n") + "\n", "utf8");
  console.log(`[generate-d1-sync] File SQL D1 berhasil ditulis ke: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
