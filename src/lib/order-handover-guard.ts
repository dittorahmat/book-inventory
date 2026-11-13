/**
 * Helper predikat kanonik penyerahan buku fisik (ADR-0018).
 * Menentukan apakah buku dapat diserahkan ke murid/wali pemegang Bukti Pengambilan.
 */
export function canHandoverBookOrder(order: {
  paymentStatus: string;
  financeHandoverApproved?: boolean | number | null;
}): boolean {
  return (
    order.paymentStatus === "paid" ||
    order.paymentStatus === "partial" ||
    order.paymentStatus === "scholarship_approved" ||
    Boolean(order.financeHandoverApproved)
  );
}

/**
 * Helper predikat kanonik kelayakan pengiriman seragam fisik (§0.75).
 * Seragam boleh dikirim jika pembayaran lunas (paid), ada cicilan (partial),
 * atau beasiswa yang telah disetujui (scholarship_approved / paid).
 * Unpaid murni dan beasiswa yang belum disetujui (scholarship_pending) ditolak.
 */
export function canDispatchUniformOrder(order: {
  paymentStatus?: string | null;
  orderType?: string | null;
}): boolean {
  if (!order.paymentStatus) return false;
  return (
    order.paymentStatus === "paid" ||
    order.paymentStatus === "partial" ||
    order.paymentStatus === "scholarship_approved"
  );
}

