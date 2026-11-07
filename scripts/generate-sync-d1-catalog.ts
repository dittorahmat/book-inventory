import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { CATALOG_SYNC_RULES } from "../src/server/sync-book-catalog";

const d1Dump = JSON.parse(readFileSync("d1-books.json", "utf-8"));
const d1Rows = (d1Dump[0]?.results || []) as Array<{
  id: string;
  title: string;
  publisher: string | null;
  buy_price: number;
  sell_price: number;
  isbn: string;
}>;

const dbLocal = new Database("./data/inventory.db", { readonly: true });
const suppliers = dbLocal.query("SELECT * FROM suppliers").all() as Record<string, unknown>[];

function escapeSql(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

// 1. INSERT OR REPLACE 11 suppliers
const supSql = suppliers
  .map((s) => {
    return `INSERT OR REPLACE INTO suppliers (id, name, code, contact_person, email, phone, address, type, created_at, updated_at) VALUES (${escapeSql(s.id)}, ${escapeSql(s.name)}, ${escapeSql(s.code)}, ${escapeSql(s.contact_person)}, ${escapeSql(s.email)}, ${escapeSql(s.phone)}, ${escapeSql(s.address)}, ${escapeSql(s.type || "book")}, ${escapeSql(s.created_at)}, ${escapeSql(s.updated_at)});`;
  })
  .join("\n");

// 2. UPDATE books in D1 with synced standard ISBN and net buy_price
const bookUpdates: string[] = [];
const bookSupplierMappings: string[] = [];

function inferSupplier(title: string, publisher: string | null): string | null {
  const t = title.toUpperCase();
  const p = (publisher || "").toUpperCase();
  if (t.includes("PRIME MATH") || p.includes("SCHOLASTIC")) return "sup-cnl";
  if (t.includes("CAMBRIDGE") || t.includes("IGCSE") || p.includes("MENTARI")) return "sup-mentari";
  if (t.includes("I LEAP") || t.includes("YOK!HOP") || t.includes("PRESCHOOL WORLD") || p.includes("PELANGI")) return "sup-pelangi";
  if (t.includes("MATEMATIKA") || t.includes("PANCASILA") || t.includes("BAHASA INDONESIA") || t.includes("IPA") || t.includes("IPS") || p.includes("ERLANGGA")) return "sup-erlangga";
  if (t.includes("AKIDAH") || t.includes("FIKIH") || t.includes("SKI") || t.includes("HADIST") || t.includes("TAJWID") || p.includes("DARSYAFI") || p.includes("SYAFI")) return "sup-darsyafii";
  if (t.includes("BAHASA ARAB") || p.includes("SEGARA")) return "sup-segara-makmur";
  return null;
}

const nowIso = new Date().toISOString();

const COLLIDING_ISBNS = new Set(["9789815027358", "9789815027365", "9789815027372"]);

for (const b of d1Rows) {
  let targetBuyPrice = b.buy_price;
  let targetIsbn = b.isbn;

  for (const rule of CATALOG_SYNC_RULES) {
    if (rule.pattern.test(b.title)) {
      if (!rule.publisherPattern || rule.publisherPattern.test(b.publisher || "")) {
        const basePrice = b.sell_price > 0 ? b.sell_price : 0;
        targetBuyPrice = rule.fixedNetPrice ?? Math.round(basePrice * (1 - rule.discountRate));
        if (rule.standardIsbn && !COLLIDING_ISBNS.has(rule.standardIsbn)) {
          targetIsbn = rule.standardIsbn;
        }
        break;
      }
    }
  }

  if (targetBuyPrice !== b.buy_price || targetIsbn !== b.isbn) {
    bookUpdates.push(`UPDATE books SET buy_price = ${targetBuyPrice}, isbn = ${escapeSql(targetIsbn)}, updated_at = ${escapeSql(nowIso)} WHERE id = ${escapeSql(b.id)};`);
  }

  const supId = inferSupplier(b.title, b.publisher);
  if (supId) {
    bookSupplierMappings.push(`INSERT OR REPLACE INTO book_suppliers (book_id, supplier_id, created_at) VALUES (${escapeSql(b.id)}, ${escapeSql(supId)}, ${escapeSql(nowIso)});`);
  }
}

const finalSql = [
  "-- 1. Suppliers",
  supSql,
  "-- 2. Books Buy Price & Standard ISBN",
  ...bookUpdates,
  "-- 3. Book Suppliers Mapping",
  ...bookSupplierMappings,
].join("\n");

writeFileSync("./data/sql/sync-d1-books-and-suppliers.sql", finalSql);
console.log(
  `Generated data/sql/sync-d1-books-and-suppliers.sql: ${suppliers.length} suppliers, ${bookUpdates.length} book updates, ${bookSupplierMappings.length} book-supplier rows.`
);
