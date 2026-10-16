/**
 * Backfill judul alias publik: alias kosong diisi dari judul real.
 * Idempoten, mendukung --dry-run. Tanpa pola uji.
 * Jalankan: bun scripts/seed-book-alias.ts [--dry-run]
 */
import { Database } from "bun:sqlite";

const DB_PATH = "./data/inventory.db";
const dryRun = process.argv.includes("--dry-run");

const db = new Database(DB_PATH);
const now = new Date().toISOString();

const targets = db
  .prepare("SELECT id, title FROM books WHERE public_title IS NULL OR trim(public_title) = ''")
  .all() as Array<{ id: string; title: string }>;

if (dryRun) {
  console.log(`dry-run: ${targets.length} buku akan diisi alias dari judul real.`);
  for (const t of targets.slice(0, 20)) console.log(`  ${t.id} ← ${t.title}`);
  if (targets.length > 20) console.log(`  ... dan ${targets.length - 20} lagi`);
  process.exit(0);
}

let updated = 0;
const stmt = db.prepare("UPDATE books SET public_title = ?, updated_at = ? WHERE id = ?");
const tx = db.transaction((rows: typeof targets) => {
  for (const r of rows) {
    stmt.run(r.title, now, r.id);
    updated += 1;
  }
});
tx(targets);
console.log(`seed-book-alias OK: ${updated} buku diisi alias.`);
