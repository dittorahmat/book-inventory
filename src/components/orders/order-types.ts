export interface StudentOrder {
  id: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  gradeLevel: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  schoolId: string;
  packageId?: string;
  packageName?: string;
  packageCode?: string;
  orderType: "regular" | "scholarship";
  paymentStatus: "unpaid" | "partial" | "paid" | "scholarship_pending" | "scholarship_approved" | "scholarship_rejected";
  fulfillmentStatus: "waiting_preparation" | "ready_for_pickup" | "picked_up" | "return_in_progress";
  totalAmount: number;
  paidAmount: number;
  handoverDeliveryNumber?: string;
  handoverDate?: string;
  handoverRecipient?: string;
  homeAddressSnapshot?: string | null;
  satuanShipmentStatus?: "belum_dikirim" | "sudah_dikirim";
  satuanShippedAt?: string | null;
  shippingCost?: number;
  shippingResi?: string | null;
  invoiceSentAt?: string | null;
  scholarshipProofUrl?: string;
  notes?: string;
  /** Jumlah klaim bukti bayar ortu yang masih menunggu verifikasi staf. */
  pendingCount?: number;
  financeHandoverApproved?: boolean | null;
  createdAt: string;
}
