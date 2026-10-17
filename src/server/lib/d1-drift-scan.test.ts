import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { systemSettings } from "../../db/schema";
import { DRIFT_ALERT_SIGNATURE_KEY, alertDrift } from "../services/d1-drift-alert";
import { columnNames, expectedTables, findDrift, scanDrift, type SchemaTable } from "./d1-drift-scan";
import type { EmailSendOptions, EmailSendResult } from "../services/email/types";

const okMail = async (_options: EmailSendOptions): Promise<EmailSendResult> => ({
  success: true,
  provider: "simulated",
  simulated: true,
});

const create = (table: string, ...columns: string[]): string =>
  `CREATE TABLE "${table}" (${columns.map((c) => `"${c}" text`).join(", ")})`;

describe("columnNames (parser murni)", () => {
  it("mengambil kolom saja, membuang constraint tabel dan menangani tanda kurung bersarang", () => {
    const sql = `CREATE TABLE "t" ("id" text PRIMARY KEY NOT NULL, "amount" integer DEFAULT (unixepoch()), "note" text, PRIMARY KEY("id", "amount"), FOREIGN KEY ("id") REFERENCES "u"("id"))`;
    expect(columnNames(sql)).toEqual(["id", "amount", "note"]);
  });
});

describe("findDrift (keputusan murni)", () => {
  const expected: SchemaTable[] = [{ name: "schools", columns: ["id", "name"] }];

  it("tanpa temuan bila tabel dan kolom lengkap", () => {
    expect(findDrift(expected, new Map([["schools", create("schools", "id", "name")]]))).toEqual([]);
  });

  it("menandai tabel yang hilang di production", () => {
    expect(findDrift(expected, new Map())).toEqual(["TABEL HILANG: `schools` tidak ada di production D1"]);
  });

  it("menandai kolom yang hilang tanpa menyalahkan kolom ekstra remote", () => {
    const remote = new Map([["schools", create("schools", "id", "legacy_note")]]);
    expect(findDrift(expected, remote)).toEqual(["KOLOM HILANG: `schools` kurang name"]);
  });
});

describe("scanDrift / alertDrift (production D1)", () => {
  it("skema hasil migrasi drizzle/ cocok dengan ekspektasi schema.ts", async () => {
    // Inilah alarmnya: bila migrasi tertinggal dari schema.ts, test ini merah
    // sebelum endpoint-nya sempat 500 di production.
    expect(await scanDrift(db)).toEqual([]);
  });

  it("expectedTables mencakup tabel inti dari objek Drizzle", () => {
    const tables = expectedTables();
    expect(tables.length).toBeGreaterThan(40);
    const schools = tables.find((table) => table.name === "schools");
    expect(schools?.columns).toContain("id");
    expect(schools?.columns).toContain("name");
  });

  it("melaporkan production bersih dan tidak mengirim email saat tidak ada drift", async () => {
    await db.delete(systemSettings).where(eq(systemSettings.key, DRIFT_ALERT_SIGNATURE_KEY));
    const result = await alertDrift(db, { mail: okMail });
    expect(result.outcome).toBe("clean");
    expect(result.count).toBe(0);
    expect(result.sent).toBe(0);
  });
});
