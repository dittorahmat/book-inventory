import { D1_INLIST_CHUNK_SIZE, chunkRows } from "../../lib/d1-write";
import type { AppDatabase } from "../../../db";
import { schools } from "../../../db/schema";

/**
 * Kernel bersama rekap penjualan (§10/§11): ambil ter-chunk + nama
 * sekolah + escape CSV + batas periode tinggal sekali di sini lalu
 * dipakai Book dan Paket Seragam. Atribusi omzet TIDAK disatukan:
 * Book proporsional-BOM, Seragam unitPriceSnapshot/campur — audit
 * kesetaraan mencatat perbedaan itu dan menundanya.
 * Khusus BACA independen (Promise.all aman); tulis dilarang via ini.
 */
export const toCsvInt = (n: number): string => String(Math.round(n));

/** Escape gaya koma (rekap buku): kutip hanya bila perlu. */
export const escapeCsvCell = (cell: string): string =>
  (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);

/** Kutip selalu gaya titik-koma (rekap seragam): beda disengaja, bukan drift. */
export const quoteCsvCell = (v: string | number): string => `"${String(v).replaceAll('"', '""')}"`;

export const periodEndIso = (to: string): string => `${to}T23:59:59.999Z`;

export const selectInChunks = async <T>(ids: string[], run: (chunk: string[]) => Promise<T[]>): Promise<T[]> =>
  ids.length === 0 ? [] : (await Promise.all(chunkRows(ids, D1_INLIST_CHUNK_SIZE).map((chunk) => run(chunk)))).flat();

/** Satu-satunya pemilik peta id → nama sekolah (lookup rekap, bukan atribusi). */
export const loadSchoolNames = async (database: AppDatabase): Promise<Map<string, string>> => {
  const rows: Array<{ id: string; name: string }> = await database
    .select({ id: schools.id, name: schools.name })
    .from(schools);
  return new Map(rows.map((s) => [s.id, s.name]));
};
