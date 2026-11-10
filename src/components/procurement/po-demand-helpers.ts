import type { Book } from "../../types";
import { effectiveBookPrice } from "../../lib/book-pricing";
import {
  DEFAULT_EMPTY_STOCK_ORDER_QTY,
  calcBufferQty,
  calcDemandQty,
  resolveInitialOrderQty,
} from "../../lib/po-demand";
import type { NewPOItemInput } from "./procurement-types";

export {
  DEFAULT_EMPTY_STOCK_ORDER_QTY,
  calcBufferQty,
  calcDemandQty,
  resolveInitialOrderQty,
};

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
 * Filter daftar buku yang valid secara eksklusif untuk suatu supplier.
 * Buku tanpa supplier (supplierIds kosong) tidak lagi dianggap universal.
 */
export function filterSupplierEligibleBooks(catalogBooks: Book[], supplierId: string): Book[] {
  if (!supplierId) return [];
  return catalogBooks.filter((b) => Array.isArray(b.supplierIds) && b.supplierIds.includes(supplierId));
}

/**
 * Membentuk baris-baris PO secara otomatis dari seluruh buku yang dipasok oleh supplier terpilih.
 * - Buku dengan permintaan siswa (> 0) diisi formula kebutuhan bersih: MAX(0, Up Buffer - Stok Gudang).
 * - Buku tanpa permintaan siswa (0) dengan stok kosong diisi default 10 eks; jika stok ada diisi 0.
 * Logistik tetap memiliki diskresi penuh untuk mengubah angka pesanan.
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
    const warehouseStock = demand?.warehouseStock ?? 0;
    const qty = resolveInitialOrderQty(studentCount, bufferPercent, warehouseStock);
    const unitPrice = buyPriceOfBook(catalogBooks, book.id);
    result.push(makePoItemRow(book.id, unitPrice, qty));
  }
  return result;
}
