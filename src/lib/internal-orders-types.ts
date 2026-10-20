/** Tipe bersama pesanan internal cabang → gudang (Internal PO). */
export interface InternalPoLine {
  packageId: string;
  quantityOrdered: number;
}
export interface InternalOrderItem {
  id: string;
  internalPoId: string;
  packageId: string;
  packageName: string;
  packageCode: string;
  quantityOrdered: number;
  quantityFulfilled: number;
}

export interface InternalOrder {
  id: string;
  poNumber: string;
  schoolId: string;
  schoolName: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: InternalOrderItem[];
}

export interface InternalShipmentItem {
  id: string;
  shipmentId: string;
  packageId: string | null;
  packageName: string | null;
  bookId: string | null;
  bookTitle: string | null;
  quantity: number;
  isOutstandingFollowup: boolean;
  receivedCondition: string | null;
  receivedNotes: string | null;
}

export interface InternalShipment {
  id: string;
  internalPoId: string;
  deliveryNoteNumber: string;
  transferShipmentId: string | null;
  shippedDate: string | null;
  receivedDate: string | null;
  receivedByUserId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  items: InternalShipmentItem[];
}

export interface PackageOption {
  id: string;
  code: string;
  name: string;
  gradeLevel?: string | null;
}

export const INTERNAL_PO_STATUS_LABELS: Record<string, string> = {
  submitted: "Diajukan",
  partial_fulfilled: "Sebagian",
  completed: "Selesai",
};

export const internalPoStatusLabel = (status: string): string => INTERNAL_PO_STATUS_LABELS[status] ?? status;

/** Satu-satunya sumber rona badge status Internal PO (dipakai tabel + tampilan lain). */
export const internalPoStatusTone = (status: string): string =>
  status === "completed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "partial_fulfilled"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-[#E7F3FF] text-[#1877F2] border-[#1877F2]/20";

export const INTERNAL_SHIPMENT_STATUS_LABELS: Record<string, string> = {
  in_transit: "Dalam Perjalanan",
  delivered: "Diterima",
  discrepancy: "Selisih",
};

export const internalShipmentStatusLabel = (status: string): string =>
  INTERNAL_SHIPMENT_STATUS_LABELS[status] ?? status;

export const internalShipmentStatusTone = (status: string): string =>
  status === "delivered"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "discrepancy"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-amber-50 text-amber-800 border-amber-200";

export const internalPoProgress = (order: InternalOrder): { fulfilled: number; ordered: number; percent: number } => {
  const ordered = order.items.reduce((sum, i) => sum + i.quantityOrdered, 0);
  const fulfilled = order.items.reduce((sum, i) => sum + Math.min(i.quantityFulfilled, i.quantityOrdered), 0);
  return { fulfilled, ordered, percent: ordered === 0 ? 0 : Math.round((fulfilled / ordered) * 100) };
};

export interface OutstandingPoLine {
  id: string;
  packageId: string;
  packageName: string | null;
  packageCode: string | null;
  quantityOrdered: number;
  quantityFulfilled: number;
  quantityRemaining: number;
}

export interface OutstandingPo {
  id: string;
  poNumber: string;
  schoolId: string;
  schoolName: string;
  status: string;
  createdAt: string;
  items: OutstandingPoLine[];
}
