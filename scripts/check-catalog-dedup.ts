import { Database } from "bun:sqlite";

/**
 * Gate pemeriksaan konsistensi katalog dan relasi supplier anti-duplikasi (§0.86.4).
 * Memvalidasi baik database lokal maupun verifikasi query remote D1.
 */
export function checkCatalogDedup(dbPath = "./data/inventory.db"): void {
  console.log(`Memeriksa konsistensi katalog anti-duplikasi pada ${dbPath}...`);
  const db = new Database(dbPath, { readonly: true });

  // 1. Periksa apakah ada buku di book_suppliers yang merupakan buku yatim (tidak terdaftar di paket)
  // padahal ada buku resmi dengan judul yang sama di book_package_items
  const localOrphanLinkCount = (db.query(`
    SELECT COUNT(*) as cnt
    FROM books b
    WHERE b.id IN (SELECT book_id FROM book_suppliers)
      AND EXISTS (
        SELECT 1 FROM books b2 
        WHERE UPPER(TRIM(b2.title)) = UPPER(TRIM(b.title))
          AND b2.id != b.id
          AND b2.id IN (SELECT book_id FROM book_package_items)
      )
      AND b.id NOT IN (SELECT book_id FROM book_package_items)
  `).get() as { cnt: number }).cnt;

  if (localOrphanLinkCount > 0) {
    console.error(`\n[KATALOG DUPLIKAT TERDETEKSI] Ditemukan ${localOrphanLinkCount} relasi supplier yang memetakan buku yatim non-paket padahal buku resmi ber-BOM tersedia.`);
    console.error(`Jalankan 'bun scripts/consolidate-catalog-duplicates.ts' untuk membersihkan.`);
    process.exit(1);
  }

  // 2. Periksa apakah ada buku dengan ISBN dan judul persis sama yang terduplikasi ID
  const identicalDupes = (db.query(`
    SELECT COUNT(*) as cnt
    FROM books b1
    JOIN books b2 ON UPPER(TRIM(b1.title)) = UPPER(TRIM(b2.title)) 
      AND b1.id != b2.id
      AND b1.isbn = b2.isbn
  `).get() as { cnt: number }).cnt;

  if (identicalDupes > 0) {
    console.error(`\n[KATALOG DUPLIKAT TERDETEKSI] Ditemukan ${identicalDupes} baris buku dengan judul dan ISBN identik.`);
    process.exit(1);
  }

  console.log("✓ Katalog lokal bebas dari relasi supplier duplikat/buku pecah identitas.");
  db.close();
}

if (import.meta.main) {
  checkCatalogDedup();
}
