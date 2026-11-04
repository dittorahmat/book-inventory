/**
 * Kanonik identifier ISBN / kode buku.
 * Mengelola aturan fallback identifier internal untuk buku yang tidak memiliki nomor ISBN fisik.
 */

/**
 * Menghasilkan slug kode internal dari judul buku dan tingkat kelas jika tersedia.
 * Contoh: "Akidah Akhlak 1", grade "1" -> "BK-SD1-AKIDAH-AKHLAK-1"
 */
export const slugifyBookCode = (title: string, gradeLevel?: string): string => {
  const cleanTitle = title
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 30);
  const gradePrefix = gradeLevel ? `SD${gradeLevel}-` : "";
  return `BK-${gradePrefix}${cleanTitle}`;
};

/** Menghasilkan kode identifier internal buku unik ketika ISBN dikosongkan. */
export const generateFallbackIsbn = (
  now = Date.now(),
  entropy: string = crypto.randomUUID(),
  title?: string,
  gradeLevel?: string
): string => {
  if (title && title.trim().length > 0) {
    return slugifyBookCode(title, gradeLevel);
  }
  const stamp = now.toString(36).toUpperCase();
  const serial = entropy.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `AUTO-${stamp}-${serial}`;
};

/** Menormalkan input ISBN: jika ada string non-kosong gunakan nilainya, jika kosong gunakan kode internal deterministik. */
export const resolveBookIsbn = (
  rawIsbn?: string | null,
  now?: number,
  entropy?: string,
  title?: string,
  gradeLevel?: string
): string => {
  const trimmed = rawIsbn?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : generateFallbackIsbn(now, entropy, title, gradeLevel);
};

