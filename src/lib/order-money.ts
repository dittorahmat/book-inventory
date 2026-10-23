/**
 * Uang order: satu rumus tagihan untuk invoice, status bayar, dan sisa tagihan.
 * Ongkir adalah bagian tagihan (ADR-0011), jadi `dueOf` selalu menambahkannya.
 * Modul murni tanpa DB agar klien dan server bisa memakai aturan yang sama.
 */

/** Total tagihan satu order: barang + ongkir. */
export const invoiceTotal = (totalAmount: number, shippingCost: number): number => totalAmount + shippingCost;

/** Due dari baris order; ongkir null/undefined dihitung nol. */
export const dueOf = (order: { totalAmount: number; shippingCost?: number | null }): number =>
  invoiceTotal(order.totalAmount, order.shippingCost ?? 0);
