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
 * Filter daftar buku yang valid secara eksklusif untuk suatu supplier.
 * Buku tanpa supplier (supplierIds kosong) tidak lagi dianggap universal.
 */
export function filterSupplierEligibleBooks(catalogBooks: Book[], supplierId: string): Book[] {
  if (!supplierId) return [];
  return catalogBooks.filter((b) => Array.isArray(b.supplierIds) && b.supplierIds.includes(supplierId));
}

/**
 * Membentuk baris-baris PO secara otomatis dari buku yang dipasok oleh supplier terpilih.
 * Hanya menyertakan buku yang memiliki permintaan siswa (demand/studentCount > 0).
 * Kuantitas pesan otomatis terisi dari perhitungan: ceil(studentCount * (1 + bufferPercent / 100)).
 */
export function buildSupplierPoItems(
  eligibleBooks: Book[],
  catalogBooks: Book[],
  demandMap: Record<string, BookDemandItemInfo>,
  bufferPercent: number
): NewPOItemInput[] {
  const result: NewPOItemInput[] = [];
  for (const book of eligibleBooks) {
    const demand = demandMap[book.id];
    const studentCount = demand?.studentCount ?? 0;
    if (studentCount <= 0) continue;
    const qty = calcDemandQty(studentCount, bufferPercent);
    if (qty <= 0) continue;
    const unitPrice = buyPriceOfBook(catalogBooks, book.id);
    result.push(makePoItemRow(book.id, unitPrice, qty));
  }
  return result;
}
