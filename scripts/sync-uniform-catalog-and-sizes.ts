import { Database } from "bun:sqlite";
import { getUniformSizeChart, normalizeUniformJenjang } from "../src/lib/uniform-size-chart";

const isDryRun = process.argv.includes("--dry-run");
const dbPath = process.env.DB_PATH || "./data/inventory.db";

console.log(`[sync-uniform] Menghubungkan ke ${dbPath}...`);
const db = new Database(dbPath);

try {
  db.exec("BEGIN TRANSACTION;");

  // 1. Update nama paket seragam menjadi "Paket Bahan Seragam Harian ..."
  const packages = db.query<{ id: string; name: string }>("SELECT id, name FROM uniform_packages;").all();
  let renamedCount = 0;
  for (const pkg of packages) {
    let newName = pkg.name;
    if (newName.includes("Seragam Bahan Seragam Harian")) {
      newName = newName.replace("Seragam Bahan Seragam Harian", "Bahan Seragam Harian");
    } else if (newName.includes("Paket Seragam Lengkap ")) {
      newName = newName.replace("Paket Seragam Lengkap ", "Paket Bahan Seragam Harian ");
    } else if (newName.startsWith("Paket Seragam ")) {
      newName = newName.replace("Paket Seragam ", "Paket Bahan Seragam Harian ");
    }
    if (newName !== pkg.name) {
      db.run("UPDATE uniform_packages SET name = ?, updated_at = datetime('now') WHERE id = ?;", [newName, pkg.id]);
      renamedCount++;
    }
  }
  console.log(`[sync-uniform] ${renamedCount} paket diperbarui namanya menjadi 'Paket Bahan Seragam Harian'.`);

  // 2. Bersihkan item olahraga dari uniform_package_bom (hanya sisakan kain harian)
  const deletedBom = db.run(
    "DELETE FROM uniform_package_bom WHERE variant_id IN (SELECT id FROM uniform_variants WHERE kind = 'olahraga');"
  );
  console.log(`[sync-uniform] ${deletedBom.changes} item olahraga dihapus dari BOM paket seragam harian.`);

  // 3. Sinkronkan uniform_sizes untuk semua varian olahraga
  const olahragaVariants = db.query<{ id: string; code: string; name: string; jenjang: string }>(
    "SELECT id, code, name, jenjang FROM uniform_variants WHERE kind = 'olahraga';"
  ).all();

  // Bersihkan ukuran lama varian olahraga
  db.run("DELETE FROM uniform_sizes WHERE variant_id IN (SELECT id FROM uniform_variants WHERE kind = 'olahraga');");

  let totalSizesInserted = 0;
  for (const v of olahragaVariants) {
    const level = normalizeUniformJenjang(v.jenjang);
    const chart = getUniformSizeChart(level);
    for (const entry of chart) {
      const sizeId = `usz-${v.id}-${entry.size.toLowerCase()}`;
      db.run(
        "INSERT OR REPLACE INTO uniform_sizes (id, variant_id, size, sort_order, created_at) VALUES (?, ?, ?, ?, datetime('now'));",
        [sizeId, v.id, entry.size, entry.chartNumber]
      );
      totalSizesInserted++;
    }
  }
  console.log(`[sync-uniform] ${totalSizesInserted} entri ukuran olahraga berhasil disinkronkan ke uniform_sizes.`);

  if (isDryRun) {
    db.exec("ROLLBACK;");
    console.log("[sync-uniform] Dry run selesai, perubahan di-rollback.");
  } else {
    db.exec("COMMIT;");
    console.log("[sync-uniform] Sukses menyimpan perubahan ke database!");
  }
} catch (err) {
  db.exec("ROLLBACK;");
  console.error("[sync-uniform] Terjadi kesalahan:", err);
  process.exit(1);
} finally {
  db.close();
}
