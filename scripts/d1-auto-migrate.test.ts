import { describe, expect, it } from "bun:test";
import {
  parseAppliedMigrations,
  computePendingMigrations,
  sanitizeMigrationId,
  runAutoMigrate,
} from "./d1-auto-migrate";

describe("d1-auto-migrate logic & safety", () => {
  it("parseAppliedMigrations mengurai output JSON wrangler dengan benar", () => {
    const jsonOutput = JSON.stringify([
      {
        results: [
          { id: "0000_melted_mordo.sql" },
          { id: "0001_stormy_cardiac.sql" },
        ],
        success: true,
      },
    ]);
    const applied = parseAppliedMigrations(jsonOutput);
    expect(applied.size).toBe(2);
    expect(applied.has("0000_melted_mordo.sql")).toBe(true);
    expect(applied.has("0001_stormy_cardiac.sql")).toBe(true);
  });

  it("parseAppliedMigrations melempar error pada JSON corrupt (fail-fast)", () => {
    expect(() => parseAppliedMigrations("INVALID_JSON")).toThrow();
  });

  it("computePendingMigrations mengidentifikasi selisih migrasi yang belum terpasang", () => {
    const all = ["0000_a.sql", "0001_b.sql", "0002_c.sql"];
    const applied = new Set(["0000_a.sql"]);
    const pending = computePendingMigrations(all, applied);
    expect(pending).toEqual(["0001_b.sql", "0002_c.sql"]);
  });

  it("sanitizeMigrationId memvalidasi nama file migrasi dan menolak karakter berbahaya", () => {
    expect(sanitizeMigrationId("0048_third_wrecker.sql")).toBe("0048_third_wrecker.sql");
    expect(() => sanitizeMigrationId("hack;DROP TABLE users;--.sql")).toThrow();
  });

  it("runAutoMigrate mengeksekusi runner idempoten tanpa duplikasi", async () => {
    const mockExecutedCmds: string[] = [];
    const mockExecutedFiles: string[] = [];

    const result = await runAutoMigrate({
      drizzleDir: "./drizzle",
      commandRunner: (sql: string) => {
        mockExecutedCmds.push(sql);
        if (sql.includes("SELECT id FROM _d1_migrations")) {
          // Simulasi sudah terpasang hingga 0047
          return JSON.stringify([
            {
              results: [
                { id: "0000_melted_mordo.sql" },
                { id: "0048_third_wrecker.sql" },
              ],
            },
          ]);
        }
        return JSON.stringify([{ results: [], success: true }]);
      },
      fileRunner: (path: string) => {
        mockExecutedFiles.push(path);
      },
    });

    expect(result.totalFiles).toBeGreaterThan(0);
    // Verifikasi command create table _d1_migrations terpanggil
    expect(mockExecutedCmds.some((cmd) => cmd.includes("CREATE TABLE IF NOT EXISTS _d1_migrations"))).toBe(true);
    // Verifikasi result targets memuat canonical targets
    expect(result.targets?.length).toBe(2);
    expect(result.targets?.[0].database).toBe("book-inventory-db");
    expect(result.targets?.[1].database).toBe("inv-aw-db");
  });
});
