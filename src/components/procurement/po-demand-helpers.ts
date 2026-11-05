import type { Book } from "../../types";
import { effectiveBookPrice } from "../../lib/book-pricing";
import type { NewPOItemInput } from "./procurement-types";

export interface BookDemandItemInfo {
  bookId: string;
  studentCount: number;
  warehouseStock: number;
  recommendedOrderQty: number;
}

export function buyPriceOfBook(catalogBooks: Book[], bookId: string, fallback = 0): number {
  const b = catalogBooks.find((x) => x.id === bookId);
  return b ? effectiveBookPrice(b).buy : fallback;
}

export const makePoItemRow = (
  bookId: string,
  unitPrice: number,
  qty: number,
  discountPercent = 0
): NewPOItemInput => ({
  bookId,
  quantityOrdered: qty,
  unitPrice,
  discountPercent,
});

/**
 * Membentuk baris-baris PO secara otomatis dari seluruh buku yang dipasok oleh supplier terpilih.
 * Kuantitas pesan otomatis terisi dari perhitungan: ceil(studentCount * (1 + bufferPercent / 100)).
 */
export function buildSupplierPoItems(
  eligibleBooks: Book[],
  catalogBooks: Book[],
  demandMap: Record<string, BookDemandItemInfo>,
  bufferPercent: number
): NewPOItemInput[] {
  const multiplier = 1 + bufferPercent / 100;
  return eligibleBooks.map((book) => {
    const demand = demandMap[book.id];
    const studentCount = demand?.studentCount ?? 0;
    const qty = studentCount > 0 ? Math.ceil(studentCount * multiplier) : 0;
    const unitPrice = buyPriceOfBook(catalogBooks, book.id);
    return makePoItemRow(book.id, unitPrice, qty);
  });
}
