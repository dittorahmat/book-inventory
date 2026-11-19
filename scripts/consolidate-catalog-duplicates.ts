import { Database } from "bun:sqlite";
import { normalizeBookTitle } from "../src/lib/isbn";

export interface DuplicateGroup {
  normalizedTitle: string;
  canonicalId: string;
  canonicalIsbn: string;
  orphanIds: string[];
}

export function consolidateBookDuplicates(dbPath = "./data/inventory.db"): {
  consolidatedTitles: number;
  orphansRemoved: number;
  stockRowsCleaned: number;
  supplierLinksCleaned: number;
} {
  const db = new Database(dbPath);

  // 1. Temukan seluruh judul yang memiliki duplikasi ID buku
  const allBookTitles = db.query(`SELECT id, title FROM books`).all() as Array<{ id: string; title: string }>;
  const titleGroups = new Map<string, string[]>();
  for (const b of allBookTitles) {
    const key = normalizeBookTitle(b.title);
    if (!titleGroups.has(key)) {
      titleGroups.set(key, []);
    }
    titleGroups.get(key)!.push(b.id);
  }

  const duplicateNormTitles = Array.from(titleGroups.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([normTitle]) => normTitle);

  let orphansRemoved = 0;
  let stockRowsCleaned = 0;
  let supplierLinksCleaned = 0;
  let consolidatedTitles = 0;

  db.transaction(() => {
    for (const normTitle of duplicateNormTitles) {
      const allMatches = db.query(`
        SELECT 
          b.id, 
          b.isbn, 
          b.title,
          b.grade_level,
          (SELECT COUNT(*) FROM book_package_items WHERE book_id = b.id) as in_package,
          (SELECT COUNT(*) FROM student_order_items WHERE book_id = b.id) as in_orders,
          (SELECT COUNT(*) FROM transfer_shipment_items WHERE book_id = b.id) as in_transfers,
          (SELECT COUNT(*) FROM purchase_order_items WHERE book_id = b.id) as in_pos
        FROM books b
        WHERE UPPER(TRIM(b.title)) = ?
        ORDER BY in_package DESC, in_orders DESC, in_transfers DESC, in_pos DESC, b.created_at ASC
      `).all(normTitle) as Array<{
        id: string;
        isbn: string;
        title: string;
        grade_level: string | null;
        in_package: number;
        in_orders: number;
        in_transfers: number;
        in_pos: number;
      }>;

      if (allMatches.length <= 1) continue;

      // Elemen pertama adalah kanonik karena memiliki relasi paket/pesanan terbanyak
      const canonical = allMatches[0];
      const orphans = allMatches.slice(1);

      for (const orphan of orphans) {
        // Alihkan foreign keys jika ada yang tertinggal
        db.query(`UPDATE OR IGNORE student_order_items SET book_id = ? WHERE book_id = ?`).run(canonical.id, orphan.id);
        db.query(`UPDATE OR IGNORE transfer_shipment_items SET book_id = ? WHERE book_id = ?`).run(canonical.id, orphan.id);
        db.query(`UPDATE OR IGNORE purchase_order_items SET book_id = ? WHERE book_id = ?`).run(canonical.id, orphan.id);
        db.query(`UPDATE OR IGNORE internal_shipment_items SET book_id = ? WHERE book_id = ?`).run(canonical.id, orphan.id);
        db.query(`UPDATE OR IGNORE book_package_items SET book_id = ? WHERE book_id = ?`).run(canonical.id, orphan.id);

        // Hapus relasi book_suppliers pada orphan
        const delSuppliers = db.query(`DELETE FROM book_suppliers WHERE book_id = ?`).run(orphan.id);
        supplierLinksCleaned += delSuppliers.changes;

        // Hapus saldo book_stocks orphan (agar tidak membingungkan/dobel stok lepas)
        const delStocks = db.query(`DELETE FROM book_stocks WHERE book_id = ?`).run(orphan.id);
        stockRowsCleaned += delStocks.changes;

        // Hapus buku orphan
        const delBook = db.query(`DELETE FROM books WHERE id = ?`).run(orphan.id);
        orphansRemoved += delBook.changes;
      }

      consolidatedTitles++;
    }
  })();

  db.close();

  return {
    consolidatedTitles,
    orphansRemoved,
    stockRowsCleaned,
    supplierLinksCleaned,
  };
}

if (import.meta.main) {
  const targetPath = process.argv[2] || "./data/inventory.db";
  console.log(`Menjalankan konsolidasi duplikasi buku pada ${targetPath}...`);
  const result = consolidateBookDuplicates(targetPath);
  console.log(`[SUKSES] Konsolidasi selesai:`);
  console.log(`- Judul buku dikonsolidasikan: ${result.consolidatedTitles}`);
  console.log(`- Buku yatim/duplikat dihapus: ${result.orphansRemoved}`);
  console.log(`- Relasi supplier dibersihkan: ${result.supplierLinksCleaned}`);
  console.log(`- Baris stok duplikat dibersihkan: ${result.stockRowsCleaned}`);
}
