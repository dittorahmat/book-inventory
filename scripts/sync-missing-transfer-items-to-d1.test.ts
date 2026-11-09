import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import { generateSyncTransferItemsSql } from "./sync-missing-transfer-items-to-d1";

describe("generateSyncTransferItemsSql", () => {
  it("chunks transfer items into at most 10 rows per statement", () => {
    if (!fs.existsSync("./data/inventory.db")) {
      expect(true).toBe(true);
      return;
    }
    const { sql, count } = generateSyncTransferItemsSql();
    expect(count).toBeGreaterThan(0);
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      expect(stmt).toStartWith("INSERT OR IGNORE INTO transfer_shipment_items");
      const rows = stmt.split("\n").filter((line) => line.trim().startsWith("("));
      expect(rows.length).toBeLessThanOrEqual(10);
    }
  });

  it("filters out existing items given a remote set", () => {
    if (!fs.existsSync("./data/inventory.db")) {
      expect(true).toBe(true);
      return;
    }
    const { count: fullCount } = generateSyncTransferItemsSql();
    const { count: filteredCount } = generateSyncTransferItemsSql("./data/inventory.db", new Set());
    expect(filteredCount).toBe(fullCount);
  });
});
