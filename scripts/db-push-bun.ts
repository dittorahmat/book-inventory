// Fallback lokal untuk `drizzle-kit push` (lihat package.json `db:push:bun`).
// `drizzle-kit push` memakai better-sqlite3 yang gagal dimuat di sebagian
// mesin (ERR_DLOPEN_FAILED); skrip ini menerapkan file migrasi SQL lewat
// `bun:sqlite` bawaan Bun sehingga langkah sinkronisasi AGENTS.md §1 tetap
// bisa jalan. Disengaja sempit dan idempoten: file yang sudah tercatat di
// `__bun_push_migrations` dilewati, sisanya diterapkan urut jurnal dan
// dicatat; pernyataan mana pun yang gagal menghentikan skrip dengan konteks
// file + nomor pernyataan.
import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";

const DB_PATH = process.env.DB_PATH || "./data/inventory.db";
const DRIZZLE_DIR = "./drizzle";
const RECORD_TABLE = "__bun_push_migrations";

const journalTags = (): string[] => {
  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  return journal.entries.map((e) => e.tag);
};

const statementsOf = (tag: string): string[] =>
  readFileSync(join(DRIZZLE_DIR, `${tag}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim().replace(/;$/, ""))
    .filter(Boolean);

const applyTag = (db: Database, tag: string, tolerant = false): { applied: number; skipped: number } => {
  const statements = statementsOf(tag);
  let applied = 0;
  let skipped = 0;
  for (const [i, stmt] of statements.entries()) {
    try {
      db.run(stmt);
      applied++;
    } catch (err) {
      const msg = (err as Error).message;
      if (tolerant && /already exists|duplicate column name/i.test(msg)) {
        skipped++;
        continue;
      }
      throw new Error(`Gagal di ${tag}.sql pernyataan #${i + 1}: ${msg}`);
    }
  }
  db.run(`INSERT OR IGNORE INTO "${RECORD_TABLE}" ("tag") VALUES (?)`, [tag]);
  return { applied, skipped };
};

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
try {
  const recordFresh =
    db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='${RECORD_TABLE}'`).all()
      .length === 0;
  if (recordFresh) {
    db.run(`CREATE TABLE "${RECORD_TABLE}" ("tag" TEXT PRIMARY KEY)`);
  }
  const recorded = new Set(
    (db.query(`SELECT "tag" FROM "${RECORD_TABLE}"`).all() as Array<{ tag: string }>).map((r) => r.tag)
  );

  const explicit = process.argv.slice(2).filter((a) => a !== "--all");
  if (explicit.length > 0) {
    let count = 0;
    for (const file of explicit) {
      const tag = basename(file, ".sql");
      count += applyTag(db, tag).applied;
      recorded.add(tag);
    }
    console.log(`db:push:bun OK: ${count} pernyataan dari ${explicit.length} file diterapkan ke ${DB_PATH}.`);
  } else {
    const tags = journalTags();
    let freshBuild = false;
    if (recordFresh) {
      const userTables = (
        db.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '${RECORD_TABLE}'`
        ).all() as Array<{ name: string }>
      ).map((r) => r.name);
      if (userTables.length > 0) {
        for (const tag of tags.slice(0, -1)) {
          db.run(`INSERT OR IGNORE INTO "${RECORD_TABLE}" ("tag") VALUES (?)`, [tag]);
          recorded.add(tag);
        }
      } else {
        freshBuild = true;
      }
    }
    const pending = process.argv.includes("--all") || freshBuild
      ? tags.filter((t) => !recorded.has(t))
      : tags.filter((t) => !recorded.has(t)).slice(-1);
    if (pending.length === 0) {
      console.log(`db:push:bun OK: tidak ada migrasi tertunda (${recorded.size} tercatat) di ${DB_PATH}.`);
    } else {
      // Alur default (satu file terbaru) toleran pada efek yang sudah ada
      // (mis. diterapkan manual sebelum skrip ini ada); --all tetap ketat.
      const tolerant = !process.argv.includes("--all");
      let applied = 0;
      let skipped = 0;
      for (const tag of pending) {
        const r = applyTag(db, tag, tolerant);
        applied += r.applied;
        skipped += r.skipped;
      }
      console.log(
        `db:push:bun OK: ${applied} diterapkan, ${skipped} dilewati (sudah ada) dari ${pending.join(", ")} di ${DB_PATH}.`
      );
    }
  }
} finally {
  db.close();
}
