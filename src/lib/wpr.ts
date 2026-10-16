/** Kanonik WPR (Weekly Progress Report): satu buku satuan wajib 750rb, hanya untuk buku. */
export const WPR_BOOK_ID = "book-wpr-weekly-report";
export const WPR_ISBN = "WPR-750K";
export const WPR_TITLE = "Weekly Progress Report";
export const WPR_PRICE = 750000;

/** True bila order satuan wajib menanggung WPR: belum ada order paket untuk murid tersebut. */
export const needsWprCharge = (packageOrderCount: number): boolean => packageOrderCount === 0;
