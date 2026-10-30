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
