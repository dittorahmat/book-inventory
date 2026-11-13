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
