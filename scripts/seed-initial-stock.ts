import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../src/db";
import { seedInitialBookStock } from "../src/server/seed-initial-book-stock-service";

const csvPath = process.argv[2] || resolve(process.cwd(), "data/rekap-aw1.csv");

if (!existsSync(csvPath)) {
  console.error(`File CSV tidak ditemukan di: ${csvPath}`);
  console.error("Gunakan: bun scripts/seed-initial-stock.ts [path-to-csv]");
  process.exit(1);
}

console.log(`Membaca data rekap awal dari: ${csvPath}`);
const csv = readFileSync(csvPath, "utf-8");

console.log("Menjalankan seeder saldo stok awal via seam moveInventoryStock...");
const result = await seedInitialBookStock(db, csv, {
  schoolId: "school-warehouse",
  referenceDoc: "REKAP-AW1-2026-2027",
  notes: "Saldo Awal Audit TA 2026/2027 dari Rekapitulasi AW-1",
});

console.log("Seeding saldo stok awal selesai:");
console.log(`  - Baris parsed: ${result.totalRowsParsed}`);
console.log(`  - Baris cocok: ${result.matchedCount}`);
console.log(`  - Buku unik: ${result.uniqueBooksCount}`);
console.log(`  - Total kuantitas: ${result.totalQuantity} eksemplar`);
