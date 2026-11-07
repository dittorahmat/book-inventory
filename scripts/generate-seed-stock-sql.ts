import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseRekapAw1Stock, matchBookToStock } from "../src/server/seed-initial-book-stock";

// Support CLI arg or standard project-relative fallback paths (§0.58.1)
const csvCandidate = process.argv[2] || resolve(process.cwd(), "data/rekap-aw1.csv");
if (!existsSync(csvCandidate)) {
  console.error(`File CSV tidak ditemukan di: ${csvCandidate}`);
  process.exit(1);
}

const csv = readFileSync(csvCandidate, "utf-8");
const items = parseRekapAw1Stock(csv);

const d1Dump = JSON.parse(readFileSync("d1-books.json", "utf-8"));
const d1Rows = (d1Dump[0]?.results || []) as Array<{ id: string; title: string; isbn: string }>;

const mappedStock: Array<{ bookId: string; title: string; stock: number; sheetTitle: string }> = [];
for (const it of items) {
  const match = matchBookToStock(it.sheetTitle, it.section, d1Rows);
  if (match) {
    mappedStock.push({
      bookId: match.id,
      title: match.title,
      stock: it.stockQuantity,
      sheetTitle: it.sheetTitle,
    });
  }
}

// Aggregate by bookId if multiple sheet entries mapped to same book
const stockByBook = new Map<string, number>();
for (const m of mappedStock) {
  stockByBook.set(m.bookId, (stockByBook.get(m.bookId) || 0) + m.stock);
}

console.log("Total sheet stock rows:", items.length);
console.log("Mapped stock rows:", mappedStock.length);
console.log("Unique books receiving stock:", stockByBook.size);

const schoolWarehouseId = "school-warehouse";
const nowIso = new Date().toISOString();

const stockInserts: string[] = [];
const adjInserts: string[] = [];

for (const [bookId, qty] of stockByBook.entries()) {
  const stockId = crypto.randomUUID();
  const adjId = crypto.randomUUID();
  stockInserts.push(
    `INSERT INTO book_stocks (id, book_id, school_id, available_quantity, reserved_quantity, updated_at) VALUES ('${stockId}', '${bookId}', '${schoolWarehouseId}', ${qty}, 0, '${nowIso}') ON CONFLICT(book_id, school_id) DO UPDATE SET available_quantity = ${qty}, updated_at = '${nowIso}';`
  );
  adjInserts.push(
    `INSERT INTO stock_adjustments (id, school_id, item_type, book_id, quantity, reason, reference_document_number, notes, created_at) VALUES ('${adjId}', '${schoolWarehouseId}', 'loose', '${bookId}', ${qty}, 'audit_reconciliation', 'REKAP-AW1-2026-2027', 'Saldo Awal Audit TA 2026/2027 dari Rekapitulasi AW-1', '${nowIso}');`
  );
}

const finalSql = [
  "-- 1. Book Stocks Initial Count",
  ...stockInserts,
  "-- 2. Stock Adjustments Audit Trail",
  ...adjInserts,
].join("\n");

writeFileSync("./data/sql/seed-initial-book-stock-d1.sql", finalSql);
console.log("Generated data/sql/seed-initial-book-stock-d1.sql with statements:", stockInserts.length + adjInserts.length);
