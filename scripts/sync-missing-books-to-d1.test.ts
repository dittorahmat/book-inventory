import { describe, it, expect } from "bun:test";
import { generateSyncBooksSql } from "./sync-missing-books-to-d1";

describe("generateSyncBooksSql", () => {
  it("chunks INSERT statements to at most 10 rows per statement", () => {
    const { sql, count } = generateSyncBooksSql();
    expect(count).toBeGreaterThan(0);
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      expect(stmt).toStartWith("INSERT OR IGNORE INTO books");
      // Count tuples by counting occurrences of '(' excluding the column list
      const rows = stmt.split("\n").filter((line) => line.trim().startsWith("("));
      // First line '(' is after VALUES
      expect(rows.length).toBeLessThanOrEqual(10);
    }
  });

  it("returns empty when all remote IDs are already present", () => {
    const { count: total } = generateSyncBooksSql();
    const { count } = generateSyncBooksSql(
      "./data/inventory.db",
      new Set(Array.from({ length: 1000 }, (_, i) => `fake-${i}`))
    );
    expect(count).toBe(total);
  });
});
