import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";

describe("d1-auto-migrate script integrity", () => {
  it("migration files in drizzle match 00xx_*.sql pattern", () => {
    const files = readdirSync("./drizzle")
      .filter((f) => /^0\d{3}_.*\.sql$/.test(f))
      .sort();
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toBe("0000_melted_mordo.sql");
  });
});
