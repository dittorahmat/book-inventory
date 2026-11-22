export interface BankTransferReconciliationItem {
  receiptId: string;
  studentName: string;
  nis: string;
  schoolName: string;
  transferDate: string;
  totalTransfer: number;
  bookAllocation: number;
  uniformAllocation: number;
  unallocatedAmount: number;
  bankName: string;
  referenceNumber: string | null;
  verificationStatus: "verified" | "pending";
}
