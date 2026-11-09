import { describe, it, expect, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { Database } from "bun:sqlite";
import { generateSyncBooksSql } from "./sync-missing-books-to-d1";

describe("generateSyncBooksSql", () => {
  const testDbDir = `./tmp-test-sync-books-${Date.now()}`;
  let testCount = 0;

  function createTestDb(): string {
    testCount++;
    const testDbPath = path.join(testDbDir, `test-inventory-${testCount}.db`);
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    const db = new Database(testDbPath);
    db.run(`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        isbn TEXT,
        title TEXT,
        author TEXT,
        publisher TEXT,
        publish_year INTEGER,
        category TEXT,
        description TEXT,
        cover_url TEXT,
        price INTEGER,
        buy_price INTEGER,
        sell_price INTEGER,
        public_title TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    const stmt = db.prepare(`
      INSERT INTO books (id, isbn, title, author, publisher, price, buy_price, sell_price, created_at, updated_at)
      VALUES ($id, $isbn, $title, $author, $publisher, $price, $buy_price, $sell_price, $created_at, $updated_at)
    `);
    for (let i = 1; i <= 25; i++) {
      stmt.run({
        $id: `book-${i}`,
        $isbn: `97800000000${i.toString().padStart(2, "0")}`,
        $title: `Book Title ${i}`,
        $author: "Author",
        $publisher: "Publisher",
        $price: 50000,
        $buy_price: 40000,
        $sell_price: 50000,
        $created_at: "2026-01-01T00:00:00.000Z",
        $updated_at: "2026-01-01T00:00:00.000Z",
      });
    }
    db.close();
    return testDbPath;
  }

  afterEach(() => {
    try {
      if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {
      // Ignored if Windows file locks delay release
    }
  });

  it("chunks INSERT statements to at most 10 rows per statement", () => {
    const testDbPath = createTestDb();
    const { sql, count } = generateSyncBooksSql(testDbPath);
    expect(count).toBe(25);
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
    expect(statements.length).toBe(3); // 10, 10, 5
    for (const stmt of statements) {
      expect(stmt).toStartWith("INSERT OR IGNORE INTO books");
      const rows = stmt.split("\n").filter((line) => line.trim().startsWith("("));
      expect(rows.length).toBeLessThanOrEqual(10);
    }
  });

  it("returns empty when all remote IDs are already present", () => {
    const testDbPath = createTestDb();
    const allIds = new Set(Array.from({ length: 25 }, (_, i) => `book-${i + 1}`));
    const { count } = generateSyncBooksSql(testDbPath, allIds);
    expect(count).toBe(0);
  });
});
