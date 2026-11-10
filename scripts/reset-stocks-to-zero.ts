import { Database } from "bun:sqlite";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  console.log("=== Memulai Reset Stok Buku & Paket ke Nol (Tiket #402) ===");

  const localDbPath = process.env.DB_PATH || "./data/inventory.db";
  const localDb = new Database(localDbPath);

  console.log("1. Mereset stok di database lokal SQLite...");
  localDb.run("BEGIN TRANSACTION;");
  try {
    localDb.run("UPDATE book_stocks SET available_quantity = 0, reserved_quantity = 0;");
    localDb.run("UPDATE package_stocks SET available_quantity = 0, reserved_quantity = 0;");
    localDb.run("DELETE FROM stock_adjustments;");
    localDb.run("COMMIT;");
    console.log("   ✓ Database lokal berhasil direset.");
  } catch (err) {
    localDb.run("ROLLBACK;");
    console.error("   ✗ Gagal mereset database lokal:", err);
    process.exit(1);
  }

  // Verifikasi lokal
  const [bRow] = localDb.query("SELECT sum(available_quantity) as total FROM book_stocks;").all() as Array<{ total: number | null }>;
  const [pRow] = localDb.query("SELECT sum(available_quantity) as total FROM package_stocks;").all() as Array<{ total: number | null }>;
  const [saRow] = localDb.query("SELECT count(*) as count FROM stock_adjustments;").all() as Array<{ count: number }>;
  console.log(`   Verifikasi Lokal -> book_stocks sum: ${bRow.total}, package_stocks sum: ${pRow.total}, stock_adjustments: ${saRow.count}`);

  console.log("2. Menyiapkan dan mengeksekusi reset ke Cloudflare D1 Remote...");
  const sqlCommands = [
    "UPDATE book_stocks SET available_quantity = 0, reserved_quantity = 0;",
    "UPDATE package_stocks SET available_quantity = 0, reserved_quantity = 0;",
    "DELETE FROM stock_adjustments;",
  ].join("\n");

  const tempSqlFile = resolve("./data/sql-reset-stock-temp.sql");
  writeFileSync(tempSqlFile, sqlCommands, "utf-8");

  try {
    console.log("   Menjalankan query remote D1...");
    execFileSync("bun", ["scripts/db-d1-exec.ts", "--file=" + tempSqlFile], {
      stdio: "inherit",
      env: process.env,
    });
    console.log("   ✓ Cloudflare D1 remote berhasil direset.");
  } catch (err) {
    console.error("   ✗ Gagal mereset Cloudflare D1 remote:", err);
    process.exit(1);
  } finally {
    try {
      unlinkSync(tempSqlFile);
    } catch {
      // temp file already unlinked or not found
    }
  }

  console.log("=== Reset Stok Selesai dengan Sukses ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
