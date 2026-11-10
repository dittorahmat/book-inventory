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
 * Formula kuantitas buffer kotor (Up Buffer):
 * CEIL(studentCount * (1 + bufferPercent / 100)).
 */
export function calcBufferQty(studentCount: number, bufferPercent: number): number {
  if (!Number.isFinite(studentCount) || studentCount <= 0) return 0;
  const safeBuffer = Number.isFinite(bufferPercent) && bufferPercent >= 0 ? bufferPercent : 0;
  return Math.ceil(studentCount * (1 + safeBuffer / 100));
}

/**
 * Formula kanonik kebutuhan bersih (Net Demand) yang memperhitungkan stok fisik gudang:
 * MAX(0, Up Buffer - warehouseStock).
 */
export function calcDemandQty(studentCount: number, bufferPercent: number, warehouseStock = 0): number {
  const upBuffer = calcBufferQty(studentCount, bufferPercent);
  if (upBuffer <= 0) return 0;
  const safeStock = Number.isFinite(warehouseStock) && warehouseStock > 0 ? warehouseStock : 0;
  return Math.max(0, upBuffer - safeStock);
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
    let qty = 0;
    if (studentCount > 0) {
      qty = calcDemandQty(studentCount, bufferPercent, warehouseStock);
    } else {
      // Tidak ada siswa: jika stok gudang kosong diisi default 10 eks untuk pengisian stok
      qty = warehouseStock <= 0 ? 10 : 0;
    }
    const unitPrice = buyPriceOfBook(catalogBooks, book.id);
    result.push(makePoItemRow(book.id, unitPrice, qty));
  }
  return result;
}
