import { describe, it, expect, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { Database } from "bun:sqlite";
import { generateSyncTransferItemsSql } from "./sync-missing-transfer-items-to-d1";

describe("generateSyncTransferItemsSql", () => {
  const testDbDir = `./tmp-test-sync-transfer-${Date.now()}`;
  let testCount = 0;

  function createTestDb(): string {
    testCount++;
    const testDbPath = path.join(testDbDir, `test-inventory-${testCount}.db`);
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    const db = new Database(testDbPath);
    db.run(`
      CREATE TABLE IF NOT EXISTS transfer_shipment_items (
        id TEXT PRIMARY KEY,
        shipment_id TEXT,
        item_type TEXT,
        book_id TEXT,
        quantity INTEGER,
        unit_price_snapshot INTEGER,
        received_condition TEXT,
        created_at TEXT
      )
    `);
    const stmt = db.prepare(`
      INSERT INTO transfer_shipment_items (id, shipment_id, item_type, book_id, quantity, unit_price_snapshot, received_condition, created_at)
      VALUES ($id, $shipment_id, $item_type, $book_id, $quantity, $unit_price_snapshot, $received_condition, $created_at)
    `);
    for (let i = 1; i <= 25; i++) {
      stmt.run({
        $id: `item-${i}`,
        $shipment_id: "trf-aw1-2026-initial",
        $item_type: "loose",
        $book_id: `book-${i}`,
        $quantity: 5,
        $unit_price_snapshot: 50000,
        $received_condition: "good",
        $created_at: "2026-01-01T00:00:00.000Z",
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

  it("chunks transfer items into at most 10 rows per statement", () => {
    const testDbPath = createTestDb();
    const { sql, count } = generateSyncTransferItemsSql(testDbPath);
    expect(count).toBe(25);
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
    expect(statements.length).toBe(3); // 10, 10, 5
    for (const stmt of statements) {
      expect(stmt).toStartWith("INSERT OR IGNORE INTO transfer_shipment_items");
      const rows = stmt.split("\n").filter((line) => line.trim().startsWith("("));
      expect(rows.length).toBeLessThanOrEqual(10);
    }
  });

  it("filters out existing items given a remote set", () => {
    const testDbPath = createTestDb();
    const existingSet = new Set(Array.from({ length: 15 }, (_, i) => `item-${i + 1}`));
    const { count } = generateSyncTransferItemsSql(testDbPath, existingSet);
    expect(count).toBe(10);
  });
});
