import { isTestSeedValue } from "../lib/validators";

/**
 * Keputusan kanonik "baris ini sampah data-uji?" untuk sekolah di production.
 * Murni (tanpa DB, tanpa IO) supaya dipakai bersama dua pemanggil dengan
 * runtime berbeda: alarm cron Worker (`d1-junk-alert.ts`) dan alarm manual
 * pre-merge (`scripts/check-d1-junk.ts`) — §8 melarang helper duplikat, jadi
 * sidik `isTestSeedValue` hanya diterapkan di satu tempat ini.
 */

/** Bentuk longgar `{ id, name }` agar cocok dengan baris JSON `wrangler d1 execute` maupun baris Drizzle bertipe. */
export interface JunkSchoolRow {
  id: unknown;
  name?: unknown;
}

/** Sekolah yang id atau namanya cocok pola data uji (sampah production). */
export const findJunkSchools = <T extends JunkSchoolRow>(rows: T[]): T[] =>
  rows.filter((row) => isTestSeedValue(row.id) || isTestSeedValue(row.name));
