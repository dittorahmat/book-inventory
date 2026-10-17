import { getTableColumns, getTableName, is, sql } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { AppDatabase } from "../../db";
import * as schema from "../../db/schema";

/**
 * Drift skema D1 (§1 AGENTS.md): tabel/kolom yang dilihat ORM (`schema.ts`)
 * tetapi tidak ada di D1 production → endpoint 500 `no such table` /
 * `no such column` padahal test lokal hijau. Dipakai alarm cron (lewat binding
 * D1, tanpa kredensial) dan — untuk `columnNames` — gate manual
 * `bun run check:d1-drift` yang membandingkan file migrasi ke remote.
 */

export interface SchemaTable {
  name: string;
  columns: string[];
}

/** Kolom dari teks `CREATE TABLE`: buang constraint, ambil identifier pertama. */
export function columnNames(createSql: string): string[] {
  const body = createSql.slice(createSql.indexOf("(") + 1, createSql.lastIndexOf(")"));
  const segments: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      segments.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) segments.push(current);
  return segments
    .map((segment) => segment.trim())
    .filter((segment) => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(segment))
    .map((segment) => segment.replace(/^[["'`]/, "").split(/[\]'"`\s]/)[0].toLowerCase())
    .filter(Boolean);
}

/** Tabel + kolom yang diharapkan ORM, dibaca langsung dari objek Drizzle. */
export const expectedTables = (): SchemaTable[] =>
  Object.values(schema)
    .filter((value) => is(value, SQLiteTable))
    .map((table) => ({
      name: getTableName(table as SQLiteTable),
      columns: Object.values(getTableColumns(table as SQLiteTable)).map((column) => column.name.toLowerCase()),
    }));

/** Murni: temuan drift = tabel hilang atau kolom hilang (tabel ekstra di remote aman). */
export const findDrift = (expected: SchemaTable[], actual: Map<string, string>): string[] =>
  expected.flatMap((table) => {
    const remoteSql = actual.get(table.name);
    if (!remoteSql) return [`TABEL HILANG: \`${table.name}\` tidak ada di production D1`];
    const missing = table.columns.filter((column) => !columnNames(remoteSql).includes(column));
    return missing.length === 0 ? [] : [`KOLOM HILANG: \`${table.name}\` kurang ${missing.join(", ")}`];
  });

/** Baca tabel live dari D1 lalu bandingkan dengan ekspektasi ORM. */
export const scanDrift = async (database: AppDatabase): Promise<string[]> => {
  const rows: Array<{ name: string; sql: string | null }> = await database.all(
    sql.raw("SELECT name, sql FROM sqlite_master WHERE type = 'table'")
  );
  const actual = new Map(
    rows
      .filter((row) => !row.name.startsWith("sqlite_") && !row.name.startsWith("_") && row.sql)
      .map((row) => [row.name, row.sql as string])
  );
  return findDrift(expectedTables(), actual);
};
