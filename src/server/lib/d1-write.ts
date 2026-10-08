import type { AppDatabase } from "../../db";

/**
 * Kanonik tulis aman-D1 (§10 AGENTS.md): SQLite lokal (bun-sqlite) mentoleransi
 * bulk insert besar dan tulis konkuren, sedangkan Cloudflare D1 menolaknya
 * (500 di production padahal test lokal hijau — insiden Okt 2026).
 * Semua service tulis bervolume WAJIB lewat seam ini, bukan hand-roll.
 */

/** Maksimal baris per statement INSERT: budget ~100 bound-parameter D1 (±9 kolom × 10 baris). */
export const D1_WRITE_CHUNK_SIZE = 10;

/** Maksimal id per klausa IN (...): 1 parameter per id. */
export const D1_INLIST_CHUNK_SIZE = 90;

/** Potong array menjadi potongan-potongan kecil untuk insert/update bertahap. */
export const chunkRows = <T>(rows: T[], size: number = D1_WRITE_CHUNK_SIZE): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, i * size + size));

/**
 * Eksekusi daftar query tulis secara atomik: satu `db.batch()` saat runtime D1,
 * fallback sekuensial di bun-sqlite. Query builder drizzle bersifat lazy
 * (dieksekusi saat await), jadi aman dikoleksi dulu baru dieksekusi di sini.
 * `Promise.all` untuk tulis DILARANG (§10) — hanya seam ini atau loop sekuensial.
 */
export async function runWriteBatch(database: AppDatabase, queries: unknown[]): Promise<void> {
  if (queries.length === 0) return;
  const batch = (database as { batch?: (q: unknown[]) => Promise<unknown> }).batch;
  if (typeof batch === "function") {
    await batch.call(database, queries);
  } else {
    for (const q of queries) await q;
  }
}

/**
 * Petakan error constraint D1 ke status 400 berpesan jelas (`{ konteks }: pesan`).
 * Mengembalikan null bila error tak dikenal — pemanggil WAJIB melempar ulangnya
 * agar tercatat di onError (500 + ref), bukan ditelan jadi 400.
 */
export const d1WriteErrorStatus = (err: unknown, konteks: string): { status: 400; message: string } | null => {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint/i.test(msg)
    ? { status: 400, message: `Gagal ${konteks}: data duplikat terdeteksi. Ulangi operasi.` }
    : /FOREIGN KEY constraint/i.test(msg)
      ? { status: 400, message: `Gagal ${konteks}: referensi data tidak valid.` }
      : null;
};
