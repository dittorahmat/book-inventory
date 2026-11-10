/** Kanonik WPR (Weekly Progress Report): satu buku satuan wajib 750rb, hanya untuk buku. */
export const WPR_BOOK_ID = "book-wpr-weekly-report";
export const WPR_ISBN = "WPR-750K";
export const WPR_TITLE = "Weekly Progress Report";
export const WPR_PRICE = 750000;

/** Predikat apakah suatu judul/ISBN/ID mengidentifikasikan WPR (Weekly Progress Report). */
export const isWprBook = (book: { id?: string | null; title?: string | null; isbn?: string | null }): boolean => {
  if (!book) return false;
  if (book.id === WPR_BOOK_ID) return true;
  const isbn = (book.isbn ?? "").trim().toUpperCase();
  if (isbn === WPR_ISBN || isbn === "BK-PRE-WPR" || isbn.startsWith("BK-SDPG-WEEKLY-PROGRESS-REPORT") || isbn.startsWith("BK-SD1-WEEKLY-PROGRESS-REPORT") || isbn.startsWith("BK-SD1-PROGRAM-WEEKLY-PROGRESS-REPORT")) return true;
  const title = (book.title ?? "").trim().toLowerCase();
  return title === "weekly progress report" || title === "weekly progress report 1 tahun" || title === "program weekly progress report 1 tahun" || title === "weekly progress report preschool";
};

/** True bila order satuan wajib menanggung WPR: belum ada order paket untuk murid tersebut. */
export const needsWprCharge = (packageOrderCount: number): boolean => packageOrderCount === 0;

/** Satu-satunya pemilik nominal WPR: 750rb bila wajib, 0 bila bebas. */
export const wprFeeForPackageCount = (packageOrderCount: number): number =>
  needsWprCharge(packageOrderCount) ? WPR_PRICE : 0;

/** Varian boolean dari aturan yang sama (eligibilitas server → rupiah). */
export const wprFeeForEligibility = (needsWpr: boolean): number => (needsWpr ? WPR_PRICE : 0);
