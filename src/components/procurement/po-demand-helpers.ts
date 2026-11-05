import type { Book } from "../../types";
import { effectiveBookPrice } from "../../lib/book-pricing";
import type { NewPOItemInput } from "./procurement-types";

export interface BookDemandItemInfo {
  bookId: string;
  studentCount: number;
  warehouseStock: number;
  recommendedOrderQty: number;
}

/**
 * Formula kanonik perhitungan kuantitas kebutuhan pesanan dengan buffer:
 * CEIL(studentCount * (1 + bufferPercent / 100)).
 */
export function calcDemandQty(studentCount: number, bufferPercent: number): number {
  if (!Number.isFinite(studentCount) || studentCount <= 0) return 0;
  const safeBuffer = Number.isFinite(bufferPercent) && bufferPercent >= 0 ? bufferPercent : 0;
  return Math.ceil(studentCount * (1 + safeBuffer / 100));
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
  return eligibleBooks.map((book) => {
    const demand = demandMap[book.id];
    const studentCount = demand?.studentCount ?? 0;
    const qty = calcDemandQty(studentCount, bufferPercent);
    const unitPrice = buyPriceOfBook(catalogBooks, book.id);
    return makePoItemRow(book.id, unitPrice, qty);
  });
}
