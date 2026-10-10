/** Tipe bersama pesanan internal cabang → gudang (IPO). */
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
}

export interface InternalShipment {
  id: string;
  internalPoId: string;
  deliveryNoteNumber: string;
  shippedDate: string | null;
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

export const IPO_STATUS_LABELS: Record<string, string> = {
  submitted: "Diajukan",
  partial_fulfilled: "Sebagian",
  completed: "Selesai",
};

export const ipoStatusLabel = (status: string): string => IPO_STATUS_LABELS[status] ?? status;

export const ipoProgress = (order: InternalOrder): { fulfilled: number; ordered: number; percent: number } => {
  const ordered = order.items.reduce((sum, i) => sum + i.quantityOrdered, 0);
  const fulfilled = order.items.reduce((sum, i) => sum + Math.min(i.quantityFulfilled, i.quantityOrdered), 0);
  return { fulfilled, ordered, percent: ordered === 0 ? 0 : Math.round((fulfilled / ordered) * 100) };
};
