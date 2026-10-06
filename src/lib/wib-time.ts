/** Zona waktu Indonesia Barat. Offset tetap +07:00 (tanpa DST). */
export const WIB_OFFSET_HOURS = 7;

/**
 * Tanggal hari ini di zona Asia/Jakarta dalam format "YYYY-MM-DD".
 *
 * Dihitung eksplisit dari epoch UTC (bukan `toLocaleDateString`/zona server)
 * supaya hasil sama di Cloudflare Workers (UTC) maupun Bun/Node lokal.
 */
export function todayWIB(now: Date = new Date()): string {
  return toWIBDate(now);
}

/** Tanggal WIB dari satu instan waktu tertentu, format "YYYY-MM-DD". */
export function toWIBDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + WIB_OFFSET_HOURS * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Tanggal WIB dari string ISO/UTC, format "YYYY-MM-DD". */
export function wibDateFrom(iso: string): string {
  return toWIBDate(new Date(iso));
}

/** Epoch UTC tengah malam WIB untuk tanggal "YYYY-MM-DD". */
export function wibStartOfDay(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00.000Z`).getTime() - WIB_OFFSET_HOURS * 60 * 60 * 1000;
}

/** True bila `todayWIB` sudah sama dengan atau melewati `effectiveFrom`. */
export function isWIBOnOrAfter(todayIsoDate: string, effectiveFrom: string): boolean {
  return todayIsoDate >= effectiveFrom;
}

/** Tahun ajaran berjalan, mis. "2026/2027", dari tanggal WIB saat ini. */
export function currentAcademicYear(now: Date = new Date()): string {
  const d = toWIBDate(now);
  const year = Number(d.slice(0, 4));
  return Number(d.slice(5, 7)) >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}
