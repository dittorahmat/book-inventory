// EXPLAIN QUERY PLAN gate (§11 AGENTS.md): gagalkan (exit 1) bila query
// partisi memakai SCAN tanpa indeks. Dijalankan via `bun run check:plans`
// memakai database lokal. Katalog kecil (books, book_packages + LIMIT)
// boleh SCAN dan didaftarkan di ALLOWED_SCAN.
import { Database } from "bun:sqlite";

interface PlannedQuery {
  name: string;
  sql: string;
  allowScan: boolean;
}

const QUERIES: PlannedQuery[] = [
  { name: "book_items by school", sql: "SELECT * FROM book_items WHERE current_school_id = 'x'", allowScan: false },
  { name: "package_items by school", sql: "SELECT * FROM package_items WHERE current_school_id = 'x'", allowScan: false },
  { name: "purchase_orders by target school", sql: "SELECT * FROM purchase_orders WHERE target_school_id = 'x'", allowScan: false },
  { name: "students by school", sql: "SELECT * FROM students WHERE school_id = 'x'", allowScan: false },
  { name: "student_book_orders by school", sql: "SELECT * FROM student_book_orders WHERE school_id = 'x'", allowScan: false },
  { name: "transfer_shipments from/to school", sql: "SELECT * FROM transfer_shipments WHERE from_school_id = 'x' OR to_school_id = 'x'", allowScan: false },
  { name: "book_returns via scoped students", sql: "SELECT book_returns.* FROM book_returns INNER JOIN students ON book_returns.student_id = students.id WHERE students.school_id = 'x'", allowScan: false },
  { name: "book_package_items by package", sql: "SELECT * FROM book_package_items WHERE package_id IN ('a','b')", allowScan: false },
  { name: "package catalog (small, LIMIT)", sql: "SELECT * FROM book_packages LIMIT 50", allowScan: true },
  { name: "book catalog (small)", sql: "SELECT * FROM books LIMIT 50", allowScan: true },
];

const sqlite = new Database("./data/inventory.db", { readonly: true });
let failed = 0;
for (const q of QUERIES) {
  const rows = sqlite.query(`EXPLAIN QUERY PLAN ${q.sql}`).all() as Array<{ detail: string }>;
  const details = rows.map((r) => r.detail);
  const scans = details.filter((d) => d.includes("SCAN"));
  if (scans.length > 0 && !q.allowScan) {
    failed += 1;
    console.error(`SCAN tanpa indeks: ${q.name}\n  ${scans.join("\n  ")}`);
  } else {
    console.log(`OK: ${q.name} -> ${details.join(" | ")}`);
  }
}
sqlite.close();
if (failed > 0) {
  console.error(`${failed} query memakai SCAN tanpa indeks (§11).`);
  process.exit(1);
}
console.log("Plan gate OK: seluruh query partisi SEARCH USING INDEX.");
