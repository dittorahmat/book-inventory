export interface InternalPoItemInput {
  packageId: string;
  quantityOrdered: number;
}

export interface CreateInternalPoInput {
  schoolId: string;
  notes?: string;
  items: InternalPoItemInput[];
}

export interface InternalPoDeps {
  now?: () => string;
  generateId?: () => string;
  generatePoNumber?: (nowIso: string) => string;
  generateItemId?: () => string;
}

export type CreateInternalPoResult =
  | { ok: true; data: { id: string; poNumber: string } }
  | { ok: false; status: 400 | 404; message: string };

export interface InternalShipmentItemInput {
  packageId?: string;
  packageItemId?: string;
  bookId?: string;
  quantity: number;
  isOutstandingFollowup?: boolean;
}

export interface FulfillInternalPoInput {
  deliveryNoteNumber: string;
  shippedDate?: string;
  notes?: string;
  transferShipmentId?: string;
  items: InternalShipmentItemInput[];
}

export type FulfillInternalPoResult =
  | { ok: true; data: { shipmentId: string; status: string } }
  | { ok: false; status: 400 | 404; message: string };

export interface InternalPoListItem {
  id: string;
  internalPoId: string;
  packageId: string;
  packageName: string | null;
  packageCode: string | null;
  quantityOrdered: number;
  quantityFulfilled: number | null;
}

export interface InternalPoListRow {
  id: string;
  poNumber: string;
  schoolId: string;
  schoolName: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: InternalPoListItem[];
}

export interface InternalShipmentListItem {
  id: string;
  shipmentId: string;
  packageId: string | null;
  packageName: string | null;
  bookId: string | null;
  bookTitle: string | null;
  quantity: number;
  isOutstandingFollowup: boolean | null;
  receivedCondition: string | null;
  receivedNotes: string | null;
}

export interface InternalShipmentListRow {
  id: string;
  internalPoId: string | null;
  destinationSchoolId?: string | null;
  deliveryNoteNumber: string;
  transferShipmentId: string | null;
  shippedDate: string | null;
  receivedDate: string | null;
  receivedByUserId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  items: InternalShipmentListItem[];
}

export type ListInternalShipmentsResult =
  | { ok: true; data: InternalShipmentListRow[] }
  | { ok: false; status: 404; message: string };
