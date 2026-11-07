import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatRupiah } from "../src/lib/transfer-pricing";
import { parsePoSheetAw1Allocation } from "../src/server/extract-aw1-po-allocations";
import { matchBookToStock } from "../src/server/seed-initial-book-stock";

interface PoDumpSheet {
  jenjang: string;
  gid: string;
  csv: string;
}

const dumpCandidate = process.argv[2] || resolve(process.cwd(), "data/po-sheets-aw1-dump.json");
if (!existsSync(dumpCandidate)) {
  console.error(`Dump file tidak ditemukan: ${dumpCandidate}`);
  process.exit(1);
}

const d1BooksCandidate = resolve(process.cwd(), "d1-books.json");
if (!existsSync(d1BooksCandidate)) {
  console.error(`D1 books dump tidak ditemukan: ${d1BooksCandidate}`);
  process.exit(1);
}

const dump = JSON.parse(readFileSync(dumpCandidate, "utf-8")) as PoDumpSheet[];
const d1Dump = JSON.parse(readFileSync(d1BooksCandidate, "utf-8"));
const d1Rows = (d1Dump[0]?.results || []) as Array<{
  id: string;
  title: string;
  isbn: string;
  buy_price: number;
  price: number;
}>;

const allAllocations = [];
for (const sheet of dump) {
  const items = parsePoSheetAw1Allocation(sheet.jenjang, sheet.csv);
  allAllocations.push(...items);
}

const qtyByBook = new Map<string, { book: (typeof d1Rows)[0]; quantity: number }>();
let unmatchedCount = 0;

for (const a of allAllocations) {
  const m = matchBookToStock(a.title, a.jenjang, d1Rows);
  if (m) {
    const fullBook = d1Rows.find((b) => b.id === m.id)!;
    const existing = qtyByBook.get(m.id);
    if (existing) {
      existing.quantity += a.quantity;
    } else {
      qtyByBook.set(m.id, { book: fullBook, quantity: a.quantity });
    }
  } else {
    unmatchedCount++;
  }
}

console.log(`Parsed ${allAllocations.length} rows across 15 sheets.`);
console.log(`Matched ${qtyByBook.size} unique books (unmatched: ${unmatchedCount}).`);

let totalDeclaredValue = 0;
let totalQuantity = 0;
for (const entry of qtyByBook.values()) {
  totalQuantity += entry.quantity;
  const unitPrice = entry.book.buy_price > 0 ? entry.book.buy_price : entry.book.price;
  totalDeclaredValue += unitPrice * entry.quantity;
}

console.log(`Total Quantity: ${totalQuantity} eksemplar`);
console.log(`Total Declared Value: ${formatRupiah(totalDeclaredValue)}`);

const shipmentNumber = "TRF-AW1-2026-INITIAL";
const warehouseId = "school-warehouse";
const aw1Id = "school-alw-1";
const shipmentId = "trf-aw1-2026-initial";
const now = new Date().toISOString();

function escapeSql(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

// 1. Header transfer_shipments
const headerSql = `INSERT INTO transfer_shipments (id, shipment_number, from_school_id, to_school_id, status, total_declared_value, dispatched_at, received_at, reason, notes, created_at, updated_at) VALUES (${escapeSql(shipmentId)}, ${escapeSql(shipmentNumber)}, ${escapeSql(warehouseId)}, ${escapeSql(aw1Id)}, 'completed', ${totalDeclaredValue}, ${escapeSql(now)}, ${escapeSql(now)}, 'Alokasi pergerakan awal buku murid AW-1', 'Alokasi awal pergerakan buku murid AW-1 TA 2026/2027 dari lembar PO', ${escapeSql(now)}, ${escapeSql(now)}) ON CONFLICT(shipment_number) DO UPDATE SET total_declared_value = excluded.total_declared_value, updated_at = excluded.updated_at;`;

// 2. transfer_shipment_items
const itemsSql: string[] = [];
// 3. book_stocks di cabang AW-1
const stockSql: string[] = [];

for (const entry of qtyByBook.values()) {
  const lineId = crypto.randomUUID();
  const unitPrice = entry.book.buy_price > 0 ? entry.book.buy_price : entry.book.price;

  itemsSql.push(
    `INSERT INTO transfer_shipment_items (id, shipment_id, item_type, book_id, quantity, unit_price_snapshot, received_condition, created_at) VALUES ('${lineId}', '${shipmentId}', 'loose', '${entry.book.id}', ${entry.quantity}, ${unitPrice}, 'good', '${now}');`
  );

  const stockId = crypto.randomUUID();
  stockSql.push(
    `INSERT INTO book_stocks (id, book_id, school_id, available_quantity, reserved_quantity, updated_at) VALUES ('${stockId}', '${entry.book.id}', '${aw1Id}', ${entry.quantity}, 0, '${now}') ON CONFLICT(book_id, school_id) DO UPDATE SET available_quantity = ${entry.quantity}, updated_at = '${now}';`
  );
}

const finalSql = [
  "-- 1. Header Transfer Shipment",
  headerSql,
  "-- 2. Transfer Shipment Items",
  ...itemsSql,
  "-- 3. Branch AW-1 Initial Book Stocks",
  ...stockSql,
].join("\n");

const outPath = resolve(process.cwd(), "data/sql/sync-aw1-transfer-d1.sql");
writeFileSync(outPath, finalSql, "utf-8");
console.log(`Generated migration SQL to: ${outPath} (${1 + itemsSql.length + stockSql.length} statements)`);
