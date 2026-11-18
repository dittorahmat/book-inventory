/**
 * Kanonik predicate & helpers untuk varian Khimar SD berukuran.
 * Khimar SD memiliki 2 ukuran bertingkat:
 * - Size 1: untuk siswa kelas 1 - 2
 * - Size 4: untuk siswa kelas 3 - 6
 */

export const KHIMAR_SD_SIZES = ["1", "4"] as const;
export type KhimarSdSize = (typeof KHIMAR_SD_SIZES)[number];

export function isKhimarSdSize(size: string): size is KhimarSdSize {
  return (KHIMAR_SD_SIZES as readonly string[]).includes(size);
}

export interface VariantIdentifiable {
  code?: string | null;
  name?: string | null;
  jenjang?: string | null;
}

/**
 * Memeriksa apakah suatu varian adalah Khimar SD (akhwat).
 */
export function isKhimarSdVariant(v: VariantIdentifiable): boolean {
  const jenjang = (v.jenjang || "").toLowerCase();
  const code = (v.code || "").toUpperCase();
  const name = (v.name || "").toUpperCase();

  const isSd = jenjang === "sd" || code.includes("-SD-") || name.includes("(SD");
  const isKhimar = code.includes("KHIMAR") || name.includes("KHIMAR");

  return isSd && isKhimar;
}

/**
 * Menghasilkan label tampilan ukuran Khimar SD untuk antarmuka pengguna.
 */
export function formatKhimarSdSizeLabel(size: string): string {
  if (size === "1") return "Size 1 (Kelas 1 - 2)";
  if (size === "4") return "Size 4 (Kelas 3 - 6)";
  return size;
}

/**
 * Menentukan ukuran default Khimar SD berdasarkan tingkat kelas siswa.
 * Mengabaikan prefix seperti "SD", "Kelas", atau suffix rombel (misal "SD 1", "Kelas 2", "1.INTER").
 * - Kelas 1 & 2 -> Size 1
 * - Kelas 3, 4, 5, 6 -> Size 4
 * Siswa non-SD atau kelas tidak dikenal fallback ke null.
 */
export function getDefaultKhimarSdSize(gradeLevel?: string | number | null): KhimarSdSize | null {
  if (gradeLevel === null || gradeLevel === undefined) return null;
  const raw = String(gradeLevel).trim().toLowerCase();
  const digitMatch = raw.match(/\b([1-6])\b/) ?? raw.match(/^([1-6])/);
  if (!digitMatch) return null;
  const gradeDigit = digitMatch[1];
  if (gradeDigit === "1" || gradeDigit === "2") return "1";
  if (["3", "4", "5", "6"].includes(gradeDigit)) return "4";
  return null;
}
