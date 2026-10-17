/**
 * Kanonik penomoran dokumen: satu pemilik idiom `${PREFIX}-${fragmen}` yang dulu
 * hand-roll di belasan situs (`Date.now().toString().slice(-N)` /
 * `iso.replace(/\D/g, "").slice(-N)`) — cerminan `newWriteId`/`writeNow` di
 * `lib/d1-write.ts`. Setiap pemanggil WAJIB byte-identik dengan idiom lama;
 * `serial` bertipe string|number agar nol di depan tidak hilang (`"0345"`).
 */

/** Fragmen waktu dari clock ISO: digit saja, N digit terakhir. */
export const isoTimeFragment = (iso: string, digits: number): string => iso.replace(/\D/g, "").slice(-digits);

/** Fragmen waktu dari epoch-ms: N digit terakhir.
 *  PERHATIAN: ruang hanya 10^N dan berulang tiap 10^N ms (6 digit ≈ 16,7 menit).
 *  Untuk kolom `.unique()`, pilih N yang cukup besar ATAU tambahkan `randomSerial`. */
export const epochTimeFragment = (epochMs: number, digits: number): string => String(epochMs).slice(-digits);

/** Nomor dokumen kanonik: `${prefix}-${fragment}` (+ serial opsional). */
export const documentNumber = (prefix: string, fragment: string, serial?: string | number): string =>
  serial === undefined ? `${prefix}-${fragment}` : `${prefix}-${fragment}-${serial}`;

/**
 * Serial acak berpadding nol (`"034512"`, ruang 10^digits) — entropi sekunder
 * untuk nomor dokumen yang hanya berbagi partisi tanggal. Menggantikan idiom
 * `Math.floor(Math.random() * 900 + 100)` yang menyalin 3 digit saja: pada
 * volume puncak (mis. seragam saat tahun ajaran baru) ruang 900/hari tabrakan
 * belasan kali sehari (audit tabrakan Okt 2026).
 */
export const randomSerial = (digits = 6): string =>
  String(Math.floor(Math.random() * 10 ** digits)).padStart(digits, "0");
