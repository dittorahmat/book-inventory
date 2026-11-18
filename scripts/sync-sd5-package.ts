import { fetchGoogleDriveResource } from "../src/server/services/drive-service";
import { parseBookCatalogData } from "../src/lib/book-import-parser";
import { Database } from "bun:sqlite";

async function syncSd5Package() {
  const fileId = "11MVVcKhgN1DoL5Gq_mAhvnuap0mqgpfHhIcRaioAcx4";
  const res = await fetchGoogleDriveResource("https://docs.google.com/spreadsheets/d/" + fileId);
  if (!res.success || res.type !== "sheet") {
    console.error("Failed to fetch:", res.message);
    return;
  }
  const parsed = parseBookCatalogData(res.data.buffer);
  const sd5Books = parsed.validBooks.filter(b => b.gradeLevel === "5");
  console.log("Extracted SD 5 Books count:", sd5Books.length);
  const sum = sd5Books.reduce((acc, b) => acc + b.price, 0);
  console.log("Sum price:", sum);

  const db = new Database("./data/inventory.db");
  const nowIso = new Date().toISOString();

  // 1. Ensure all 21 books exist in books table
  const bookIds: Array<{ id: string; price: number }> = [];
  for (const b of sd5Books) {
    let existing = db.query("SELECT id, price FROM books WHERE title = ?").get(b.title) as { id: string; price: number } | null;
    if (!existing && b.isbn) {
      existing = db.query("SELECT id, price FROM books WHERE isbn = ?").get(b.isbn) as { id: string; price: number } | null;
    }
    let bookId: string;
    if (existing) {
      bookId = existing.id;
      db.query("UPDATE books SET price = ?, sell_price = ?, grade_level = '5', curriculum_type = 'INTER', updated_at = ? WHERE id = ?")
        .run(b.price, b.price, nowIso, bookId);
    } else {
      bookId = crypto.randomUUID();
      db.query("INSERT INTO books (id, isbn, title, author, publisher, publish_year, price, buy_price, sell_price, grade_level, curriculum_type, created_at, updated_at) VALUES (?, ?, ?, 'Tim Al-Wildan', ?, 2026, ?, ?, ?, '5', 'INTER', ?, ?)")
        .run(bookId, b.isbn || ("BK-SD5-" + crypto.randomUUID().slice(0, 8)), b.title, b.publisher || "Al-Wildan Press", b.price, Math.round(b.price * 0.8), b.price, nowIso, nowIso);
    }
    bookIds.push({ id: bookId, price: b.price });
  }

  // 2. Update package f71cd804-98d2-4276-9cc9-b7122d3ad874 (PKG-SD5-INT-2026-2027)
  const pkgId = "f71cd804-98d2-4276-9cc9-b7122d3ad874";
  db.query("UPDATE book_packages SET price = ?, updated_at = ? WHERE id = ?").run(sum, nowIso, pkgId);

  // 3. Replace BOM
  db.query("DELETE FROM book_package_items WHERE package_id = ?").run(pkgId);
  const insertItem = db.query("INSERT INTO book_package_items (id, package_id, book_id, quantity, created_at) VALUES (?, ?, ?, 1, ?)");
  for (const bi of bookIds) {
    insertItem.run(crypto.randomUUID(), pkgId, bi.id, nowIso);
  }

  console.log("Successfully synced package f71cd804-98d2-4276-9cc9-b7122d3ad874 with", bookIds.length, "books!");
}
syncSd5Package();
