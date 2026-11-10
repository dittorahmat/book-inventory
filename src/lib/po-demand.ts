/**
 * Nilai default kuantitas pesanan untuk buku yang tidak memiliki demand siswa
 * dan stok gudang fisiknya kosong (0).
 */
export const DEFAULT_EMPTY_STOCK_ORDER_QTY = 10;

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

/**
 * Menentukan kuantitas pesanan awal (initial order quantity):
 * - Jika ada demand siswa (> 0): gunakan Net Demand.
 * - Jika tidak ada demand siswa (= 0): isi DEFAULT_EMPTY_STOCK_ORDER_QTY (10) bila stok gudang kosong (0),
 *   atau 0 bila stok gudang sudah tersedia.
 */
export function resolveInitialOrderQty(
  studentCount: number,
  bufferPercent: number,
  warehouseStock = 0
): number {
  if (studentCount > 0) {
    return calcDemandQty(studentCount, bufferPercent, warehouseStock);
  }
  return warehouseStock <= 0 ? DEFAULT_EMPTY_STOCK_ORDER_QTY : 0;
}
