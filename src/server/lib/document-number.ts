/**
 * Kanonik penomoran dokumen: satu pemilik idiom `${PREFIX}-${fragmen}` yang dulu
 * hand-roll di belasan situs (`Date.now().toString().slice(-N)` /
 * `iso.replace(/\D/g, "").slice(-N)`) — cerminan `newWriteId`/`writeNow` di
 * `lib/d1-write.ts`. Setiap pemanggil WAJIB byte-identik dengan idiom lama;
 * `serial` bertipe string|number agar nol di depan tidak hilang (`"0345"`).
 */

/** Fragmen waktu dari clock ISO: digit saja, N digit terakhir. */
export const isoTimeFragment = (iso: string, digits: number): string => iso.replace(/\D/g, "").slice(-digits);

/** Fragmen waktu dari epoch-ms: N digit terakhir. */
export const epochTimeFragment = (epochMs: number, digits: number): string => String(epochMs).slice(-digits);

/** Nomor dokumen kanonik: `${prefix}-${fragment}` (+ serial opsional). */
export const documentNumber = (prefix: string, fragment: string, serial?: string | number): string =>
  serial === undefined ? `${prefix}-${fragment}` : `${prefix}-${fragment}-${serial}`;
