import { Database } from "bun:sqlite";
import { spawnSync } from "child_process";

// 1. Bersihkan database lokal
const localPath = "./data/inventory.db";
try {
  const db = new Database(localPath);
  db.exec("PRAGMA foreign_keys = OFF;");
  const tables = [
    "refund_slips", "payment_allocations", "payment_receipts",
    "student_order_items", "student_book_orders",
    "uniform_refunds", "uniform_rejects", "uniform_exchanges", "uniform_order_items", "uniform_orders",
    "uniform_po_items", "uniform_pos", "uniform_package_stock", "uniform_package_bom", "uniform_packages",
    "uniform_stock", "uniform_sizes", "uniform_variants",
    "internal_shipment_items", "internal_shipments", "transfer_shipment_items", "transfer_shipments",
    "branch_charges", "branch_claims", "term_reconciliation_items", "term_reconciliations",
    "vendor_return_items", "vendor_returns", "book_returns",
    "purchase_order_receipt_items", "purchase_order_receipts", "purchase_order_items", "purchase_orders",
    "internal_purchase_order_items", "internal_purchase_orders",
    "package_items", "book_package_items", "book_packages", "book_items", "books",
    "book_suppliers", "suppliers", "students", "verifications"
  ];
  for (const t of tables) {
    try {
      db.exec(`DELETE FROM ${t};`);
    } catch {
      // ignore table missing
    }
  }
  db.exec("PRAGMA foreign_keys = ON;");
  console.log("Local SQLite database cleaned successfully.");
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Local SQLite purge error:", msg);
}

// 2. Pembersihan D1 remote dengan urutan aman constraint
console.log("Memulai pembersihan D1 remote...");
const remoteCommands = [
  "UPDATE student_book_orders SET assigned_package_item_id = NULL;",
  "DELETE FROM refund_slips;",
  "DELETE FROM payment_allocations;",
  "DELETE FROM payment_receipts;",
  "DELETE FROM student_order_items;",
  "DELETE FROM uniform_refunds;",
  "DELETE FROM uniform_rejects;",
  "DELETE FROM uniform_exchanges;",
  "DELETE FROM uniform_order_items;",
  "DELETE FROM uniform_orders;",
  "DELETE FROM uniform_po_items;",
  "DELETE FROM uniform_pos;",
  "DELETE FROM uniform_package_stock;",
  "DELETE FROM uniform_package_bom;",
  "DELETE FROM uniform_packages;",
  "DELETE FROM uniform_stock;",
  "DELETE FROM uniform_sizes;",
  "DELETE FROM uniform_variants;",
  "DELETE FROM internal_shipment_items;",
  "DELETE FROM internal_shipments;",
  "DELETE FROM transfer_shipment_items;",
  "DELETE FROM transfer_shipments;",
  "DELETE FROM branch_charges;",
  "DELETE FROM branch_claims;",
  "DELETE FROM term_reconciliation_items;",
  "DELETE FROM term_reconciliations;",
  "DELETE FROM vendor_return_items;",
  "DELETE FROM vendor_returns;",
  "DELETE FROM book_returns;",
  "DELETE FROM purchase_order_receipt_items;",
  "DELETE FROM purchase_order_receipts;",
  "DELETE FROM purchase_order_items;",
  "DELETE FROM purchase_orders;",
  "DELETE FROM internal_purchase_order_items;",
  "DELETE FROM internal_purchase_orders;",
  "DELETE FROM student_book_orders;",
  "DELETE FROM package_items;",
  "DELETE FROM book_package_items;",
  "DELETE FROM book_packages;",
  "DELETE FROM book_items;",
  "DELETE FROM books;",
  "DELETE FROM book_suppliers;",
  "DELETE FROM suppliers;",
  "DELETE FROM students;",
  "DELETE FROM verifications;"
];

for (const cmd of remoteCommands) {
  spawnSync("cmd.exe", ["/c", "wrangler", "d1", "execute", "book-inventory-db", "--remote", `--command=${cmd}`], {
    encoding: "utf8"
  });
}
console.log("Pembersihan D1 remote selesai.");
