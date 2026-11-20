export interface BankTransferReconciliationItem {
  receiptId: string;
  allocationId: string;
  studentName: string;
  nis: string;
  schoolName: string;
  transferDate: string;
  totalTransfer: number;
  allocationAmount: number;
  transferTarget: "Buku" | "Seragam";
  bankName: string;
  referenceNumber: string | null;
}
