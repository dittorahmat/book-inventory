// Gate drift D1 (§1 AGENTS.md): gagalkan (exit 1) bila skema remote
// Cloudflare D1 berbeda dari `drizzle/00*.sql` (tabel hilang = endpoint 500
// di production padahal test lokal hijau — insiden Okt 2026: migrasi 0010
// tak pernah teraplikasi ke remote). Dijalankan manual pre-merge via
// `bun run check:d1-drift` karena butuh kredensial D1 (bukan job CI).
import { Database } from "bun:sqlite";
import { $ } from "bun";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { columnNames } from "../src/server/lib/d1-drift-scan";

const D1_DATABASE = process.env.D1_DATABASE || "book-inventory-db";
const DRIZZLE_DIR = process.env.DRIZZLE_DIR || "./drizzle";

// Bangun skema ekspektasi dari file migrasi ke DB memori (pola sama dengan
// explain-plan.ts) agar deterministik tanpa bergantung pada DB lokal.
const buildExpected = (): Map<string, string> => {
  const sqlite = new Database(":memory:");
  try {
    const files = readdirSync(DRIZZLE_DIR)
      .filter((f) => /^0\d{3}_.*\.sql$/.test(f))
      .sort();
    if (files.length === 0) throw new Error(`tidak ada file migrasi di ${DRIZZLE_DIR}.`);
    for (const file of files) {
      const sql = readFileSync(join(DRIZZLE_DIR, file), "utf8");
      for (const stmt of sql.split("--> statement-breakpoint")) {
        const trimmed = stmt.trim();
        if (trimmed) sqlite.run(trimmed);
      }
    }
    const rows = sqlite.query(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name"
    ).all() as Array<{ name: string; sql: string }>;
    return new Map(rows.map((r) => [r.name, r.sql]));
  } finally {
    sqlite.close();
  }
};

interface D1ExecuteOutput {
  results?: Array<{ name: string; sql: string }>;
}

const fetchRemote = async (): Promise<Map<string, string>> => {
  const out =
    await $`./node_modules/.bin/wrangler d1 execute ${D1_DATABASE} --remote --command=${"SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name"} --json`.text();
  const parsed = JSON.parse(out) as D1ExecuteOutput[] | D1ExecuteOutput;
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const rows = first?.results ?? [];
  return new Map(
    rows.filter((r) => !r.name.startsWith("sqlite_") && !r.name.startsWith("_cf_")).map((r) => [r.name, r.sql])
  );
};

const expected = buildExpected();
const remote = await fetchRemote();

let failed = 0;
for (const [table, sql] of expected) {
  const remoteSql = remote.get(table);
  if (!remoteSql) {
    console.error(`HILANG di D1 remote: tabel \`${table}\` (endpoint menyentuhnya akan 500)`);
    failed++;
    continue;
  }
  const missingCols = columnNames(sql).filter((c) => !columnNames(remoteSql).includes(c));
  if (missingCols.length > 0) {
    console.error(`KOLOM HILANG di D1 remote: \`${table}\` kurang: ${missingCols.join(", ")}`);
    failed++;
  }
}
for (const table of remote.keys()) {
  if (!expected.has(table)) console.log(`Info: tabel \`${table}\` ada di remote tapi tak ada di drizzle/ (ekstra, aman).`);
}

if (failed > 0) {
  console.error(`\nDrift D1 terdeteksi (${failed} temuan): sinkronkan remote sebelum merge (lihat AGENTS.md §1).`);
  process.exit(1);
}
console.log(`D1 drift OK: ${expected.size} tabel cocok dengan drizzle/.`);
