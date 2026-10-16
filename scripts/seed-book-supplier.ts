/**
 * Seed relasi Book–supplier dari riwayat Supplier PO.
 * Aturan: tiap buku dipetakan ke SELURUH supplier berbeda yang pernah
 * memasoknya (distinct supplierId). Tanpa riwayat -> tetap universal
 * (tanpa baris) + dilaporkan di unmapped-books.csv untuk assignment manual.
 * Idempoten, mendukung --dry-run.
 * Jalankan: bun scripts/seed-book-supplier.ts [--dry-run]
 */
import { Database } from "bun:sqlite";
import { writeFileSync } from "node:fs";

const DB_PATH = "./data/inventory.db";
const dryRun = process.argv.includes("--dry-run");

const db = new Database(DB_PATH);
const now = new Date().toISOString();

type Pair = { bookId: string; supplierId: string };
const history = db
  .prepare(
    `SELECT DISTINCT poi.book_id AS bookId, po.supplier_id AS supplierId
     FROM purchase_order_items poi
     INNER JOIN purchase_orders po ON poi.purchase_order_id = po.id`
  )
  .all() as Pair[];

const existing = db.prepare("SELECT book_id AS bookId, supplier_id AS supplierId FROM book_suppliers").all() as Pair[];
const known = new Set(existing.map((e) => `${e.bookId}::${e.supplierId}`));
const fresh = history.filter((h) => !known.has(`${h.bookId}::${h.supplierId}`));

const mappedBooks = new Set(history.map((h) => h.bookId));
const allBooks = db.prepare("SELECT id FROM books").all() as Array<{ id: string }>;
const unmapped = allBooks.map((b) => b.id).filter((id) => !mappedBooks.has(id));

if (dryRun) {
  console.log(`dry-run: ${fresh.length} relasi baru (${history.length} historis, ${existing.length} sudah ada).`);
  console.log(`dry-run: ${unmapped.length} buku tanpa riwayat PO -> tetap universal.`);
  for (const u of unmapped.slice(0, 20)) console.log(`  unmapped: ${u}`);
  if (unmapped.length > 20) console.log(`  ... dan ${unmapped.length - 20} lagi`);
  process.exit(0);
}

const insert = db.prepare("INSERT OR IGNORE INTO book_suppliers (book_id, supplier_id, created_at) VALUES (?, ?, ?)");
const tx = db.transaction((rows: Pair[]) => {
  for (const r of rows) insert.run(r.bookId, r.supplierId, now);
});
tx(fresh);

if (unmapped.length > 0) {
  writeFileSync("./data/unmapped-books.csv", `book_id\n${unmapped.join("\n")}\n`);
}
console.log(`seed-book-supplier OK: ${fresh.length} relasi ditambah, ${unmapped.length} buku tetap universal (lihat data/unmapped-books.csv).`);
