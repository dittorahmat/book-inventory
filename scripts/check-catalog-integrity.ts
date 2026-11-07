import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";

/**
 * Gate Integritas Katalog & Paket Buku (§0.66)
 * Memeriksa:
 * 1. Tidak ada referensi orphan pada book_package_items (book_id harus eksis di books).
 * 2. Tidak ada paket buku aktif yang merujuk ke book_id yang tidak ada saldo/stok sama sekali di seluruh sistem.
 */

const DB_PATH = "./data/inventory.db";

if (!existsSync(DB_PATH)) {
  console.log("check:catalog-integrity SKIP: ./data/inventory.db tidak ditemukan di lokal.");
  process.exit(0);
}

const db = new Database(DB_PATH, { readonly: true });
let hasError = false;

try {
  // 1. Cek orphan package items (book_id tidak ada di tabel books)
  const orphanQuery = `
    SELECT p.id as package_id, p.name as package_name, pi.book_id
    FROM book_packages p
    JOIN book_package_items pi ON p.id = pi.package_id
    LEFT JOIN books b ON pi.book_id = b.id
    WHERE b.id IS NULL
  `;
  const orphans = db.query(orphanQuery).all() as Array<{ package_id: string; package_name: string; book_id: string }>;

  if (orphans.length > 0) {
    console.error(`❌ [check:catalog-integrity] Ditemukan ${orphans.length} item paket yang merujuk ke book_id fiktif (orphan):`);
    for (const item of orphans.slice(0, 5)) {
      console.error(`   - Paket: ${item.package_name} (${item.package_id}) -> book_id: ${item.book_id}`);
    }
    hasError = true;
  }

  // 2. Cek konsistensi judul ganda yang berpotensi membingungkan alokasi paket vs stok
  const packageBooksWithoutAnyStockQuery = `
    SELECT DISTINCT b.id, b.title, p.name as package_name
    FROM book_packages p
    JOIN book_package_items pi ON p.id = pi.package_id
    JOIN books b ON pi.book_id = b.id
    LEFT JOIN book_stocks bs ON b.id = bs.book_id
    GROUP BY b.id, p.name
    HAVING COUNT(bs.id) = 0
  `;
  const unstocked = db.query(packageBooksWithoutAnyStockQuery).all() as Array<{ id: string; title: string; package_name: string }>;

  if (unstocked.length > 0) {
    console.warn(`⚠️ [check:catalog-integrity] Ditemukan ${unstocked.length} buku dalam paket yang belum memiliki record stok di cabang/gudang manapun:`);
    for (const item of unstocked.slice(0, 5)) {
      console.warn(`   - [${item.id}] ${item.title} (di paket: ${item.package_name})`);
    }
  }

  if (hasError) {
    process.exit(1);
  }

  console.log("Catalog-integrity gate OK: seluruh item paket buku terhubung valid ke master buku.");
} catch (err) {
  console.error("Gagal memeriksa integritas katalog:", err);
  process.exit(1);
}
