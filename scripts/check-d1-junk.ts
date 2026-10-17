// Alarm sampah test di D1 remote (§6 AGENTS.md): gagalkan (exit 1) bila ada
// baris pola-uji di production (insiden 175 sekolah sampah, Okt 2026).
// Read-only (SELECT saja). Dijalankan manual pre-merge via
// `bun run check:d1-junk` karena butuh kredensial D1 (bukan job CI) —
// pola sama dengan check-d1-drift.ts.
import { $ } from "bun";
import { findJunkSchools } from "../src/server/services/d1-junk-scan";

const D1_DATABASE = process.env.D1_DATABASE || "book-inventory-db";

interface D1ExecuteOutput {
  results?: Array<Record<string, unknown>>;
}

const fetchRows = async (sql: string): Promise<Array<Record<string, unknown>>> => {
  const out = await $`./node_modules/.bin/wrangler d1 execute ${D1_DATABASE} --remote --command=${sql} --json`.text();
  const parsed = JSON.parse(out) as D1ExecuteOutput[] | D1ExecuteOutput;
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
};

// Prefilter longgar di SQL (LIKE), keputusan presisi di TS via sidik kanonik.
const PREFILTER =
  `id LIKE '%test%' OR id LIKE 'school-empty-%' OR id LIKE 'school-iso-%' OR id LIKE 'school-lock-%' ` +
  `OR id LIKE 'school-nis-%' OR id LIKE 'school-sch-%' OR id LIKE 'school-t%' OR id LIKE 'school-vol-%' ` +
  `OR id LIKE 'school-sh-%' OR id LIKE 'school-wh-%' OR name LIKE '%test%' OR name LIKE 'Sekolah school-%'`;

const schools = await fetchRows(`SELECT id, name FROM schools WHERE ${PREFILTER}`);
// Keputusan presisi via modul kanonik yang sama dipakai alarm cron production.
const junk = findJunkSchools(schools);

if (junk.length > 0) {
  console.error(`D1 JUNK TERDETEKSI: ${junk.length} sekolah pola-uji di production:`);
  for (const r of junk.slice(0, 20)) console.error(`  ${String(r.id)}  ← ${String(r.name)}`);
  if (junk.length > 20) console.error(`  ... dan ${junk.length - 20} lagi`);
  console.error("Hapus manual terverifikasi (lihat AGENTS.md §6): predikat NOT IN 5 id asli + cek 0 relasi anak.");
  process.exit(1);
}
console.log("D1 junk OK: tidak ada sekolah pola-uji di production.");
