/**
 * Kanonik identifier ISBN / kode buku.
 * Mengelola aturan fallback identifier otomatis untuk buku yang tidak memiliki nomor ISBN fisik.
 */

/** Menghasilkan kode identifier internal buku unik ketika ISBN dikosongkan. */
export const generateFallbackIsbn = (now = Date.now(), entropy: string = crypto.randomUUID()): string => {
  const stamp = now.toString(36).toUpperCase();
  const serial = entropy.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `AUTO-${stamp}-${serial}`;
};

/** Menormalkan input ISBN: jika ada string non-kosong gunakan nilainya, jika kosong gunakan fallback unik. */
export const resolveBookIsbn = (rawIsbn?: string | null, now?: number, entropy?: string): string => {
  const trimmed = rawIsbn?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : generateFallbackIsbn(now, entropy);
};
