// EXPLAIN QUERY PLAN gate (§11 AGENTS.md): gagalkan (exit 1) bila query
// partisi memakai SCAN tanpa indeks. Dijalankan via `bun run check:plans`
// memakai database lokal. Katalog kecil (books, book_packages + LIMIT)
// boleh SCAN dan didaftarkan di ALLOWED_SCAN.
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  { name: "lookup-order partitioned join", sql: "SELECT student_book_orders.id FROM student_book_orders INNER JOIN students ON student_book_orders.student_id = students.id INNER JOIN schools ON student_book_orders.school_id = schools.id LEFT JOIN book_packages ON student_book_orders.package_id = book_packages.id WHERE student_book_orders.school_id = 'x' AND (lower(student_book_orders.order_number) LIKE '%q%' OR lower(students.nis) LIKE '%q%' OR lower(students.name) LIKE '%q%') LIMIT 10", allowScan: false },
  { name: "students partitioned search lower()", sql: "SELECT * FROM students WHERE school_id = 'x' AND status = 'active' AND (lower(name) LIKE '%q%' OR lower(nis) LIKE '%q%' OR lower(parent_name) LIKE '%q%') LIMIT 50", allowScan: false },
  { name: "student-orders partitioned search lower()", sql: "SELECT student_book_orders.id FROM student_book_orders INNER JOIN students ON student_book_orders.student_id = students.id WHERE student_book_orders.school_id = 'x' AND (lower(students.name) LIKE '%q%' OR lower(students.nis) LIKE '%q%' OR lower(student_book_orders.order_number) LIKE '%q%') LIMIT 50", allowScan: false },
  { name: "uniform-orders partitioned search lower()", sql: "SELECT uniform_orders.id FROM uniform_orders INNER JOIN students ON uniform_orders.student_id = students.id WHERE uniform_orders.school_id = 'x' AND uniform_orders.shipment_status = 'belum_dikirim' AND (lower(students.name) LIKE '%q%' OR lower(students.nis) LIKE '%q%' OR lower(uniform_orders.order_number) LIKE '%q%') LIMIT 50", allowScan: false },
  { name: "transfer_shipments from/to school", sql: "SELECT * FROM transfer_shipments WHERE from_school_id = 'x' OR to_school_id = 'x'", allowScan: false },
  { name: "book_returns via scoped students", sql: "SELECT book_returns.* FROM book_returns INNER JOIN students ON book_returns.student_id = students.id WHERE students.school_id = 'x'", allowScan: false },
  { name: "book_package_items by package", sql: "SELECT * FROM book_package_items WHERE package_id IN ('a','b')", allowScan: false },
  { name: "books by id IN-list (category attribution)", sql: "SELECT id, category FROM books WHERE id IN ('a','b')", allowScan: false },
  { name: "internal_shipment_items by shipment", sql: "SELECT * FROM internal_shipment_items WHERE shipment_id = 'x'", allowScan: false },
  { name: "package catalog (small, LIMIT)", sql: "SELECT * FROM book_packages LIMIT 50", allowScan: true },
  { name: "book catalog (small)", sql: "SELECT * FROM books LIMIT 50", allowScan: true },
  { name: "uniform_orders by school", sql: "SELECT * FROM uniform_orders WHERE school_id = 'x'", allowScan: false },
  { name: "uniform lookup partitioned join", sql: "SELECT uniform_orders.id FROM uniform_orders INNER JOIN students ON uniform_orders.student_id = students.id WHERE uniform_orders.school_id = 'x' AND (uniform_orders.order_number LIKE '%q%' OR students.nis LIKE '%q%' OR students.name LIKE '%q%') LIMIT 10", allowScan: false },
  { name: "uniform_order_items by order", sql: "SELECT * FROM uniform_order_items WHERE order_id IN ('a','b')", allowScan: false },
  { name: "uniform_exchanges via scoped orders", sql: "SELECT uniform_exchanges.* FROM uniform_exchanges INNER JOIN uniform_orders ON uniform_exchanges.order_id = uniform_orders.id WHERE uniform_orders.school_id = 'x'", allowScan: false },
  { name: "uniform_claims by school", sql: "SELECT * FROM uniform_claims WHERE school_id = 'x'", allowScan: false },
];

// Bangun skema dari file migrasi ke DB memori agar gate deterministik di
// mana pun (CI fresh checkout belum punya ./data/inventory.db). EXPLAIN
// QUERY PLAN hanya butuh indeks, bukan data.
const sqlite = new Database(":memory:");
try {
  const migrationFiles = readdirSync("./drizzle")
    .filter((f) => /^0\d{3}_.*\.sql$/.test(f))
    .sort();
  if (migrationFiles.length === 0) {
    throw new Error("Plan gate gagal: tidak ada file migrasi di drizzle/.");
  }
  for (const file of migrationFiles) {
    const sql = readFileSync(join("./drizzle", file), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) sqlite.run(trimmed);
    }
  }
} catch (err) {
  sqlite.close();
  throw err;
}
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
