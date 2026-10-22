/** Tab portal publik yang dibuka langsung dari URL (deep-link). */
export type PublicEntryTab = "book_return" | "uniform";

/**
 * Satu-satunya pemilik pemetaan URL → tab portal publik. Halaman `/refund`
 * lama tetap hidup sebagai alias `?mode=refund`; keduanya mendarat di tab
 * Refund Buku, bukan halaman terpisah.
 */
export const resolvePublicEntryTab = (
  pathname: string,
  search: string
): PublicEntryTab | undefined => {
  if (pathname === "/refund" || search.includes("mode=refund")) return "book_return";
  if (pathname === "/seragam" || search.includes("mode=seragam")) return "uniform";
  return undefined;
};
