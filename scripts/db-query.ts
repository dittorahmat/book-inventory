// Pintu baca-saja ke DB SQLite lokal (AGENTS.md §1.1). Tujuan: agent bisa
// memeriksa data nyata — duplikat, volume, sampel baris, `EXPLAIN` — tanpa
// menulis skrip sekali-pakai yang lalu dihapus lagi.
//
// Sengaja sempit: hanya SELECT/WITH/EXPLAIN/PRAGMA, satu pernyataan, DB dibuka
// readonly. Tulis ke D1 remote tetap lewat disiplin §6.2 (verifikasi target +
// pra-cek baris), bukan lewat skrip ini.
//
// Pemakaian: bun run db:query "SELECT COUNT(*) FROM students"
//            bun run db:query "PRAGMA index_list('students')"
import { Database } from "bun:sqlite";

const READ_ONLY = /^\s*(select|with|explain|pragma)\b/i;
const sql = process.argv.slice(2).join(" ").trim();

if (!sql) {
  console.error('Pakai: bun run db:query "SELECT ..." (baca-saja; DB_PATH atau ./data/inventory.db)');
  process.exit(2);
}
if (!READ_ONLY.test(sql)) {
  console.error("db:query hanya untuk BACA (SELECT/WITH/EXPLAIN/PRAGMA). Tulis diatur AGENTS.md §6.2.");
  process.exit(2);
}
if (sql.replace(/;\s*$/, "").includes(";")) {
  console.error("db:query menolak banyak pernyataan dalam satu panggilan (cegah penyelundupan tulis).");
  process.exit(2);
}

const path = process.env.DB_PATH || "./data/inventory.db";
const db = new Database(path, { readonly: true, create: false });
try {
  const rows = db.query(sql).all();
  console.log(JSON.stringify(rows, null, 2));
  console.error(`-- ${rows.length} baris dari ${path}`);
} finally {
  db.close();
}
