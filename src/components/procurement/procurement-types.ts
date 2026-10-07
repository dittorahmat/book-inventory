import type { PrintablePo } from "./PoPrintView";

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface PurchaseOrderItem {
  id: string;
  bookId: string;
  title: string;
  isbn: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  discountPercent: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  targetSchoolId: string;
  schoolName: string;
  status: "draft" | "ordered" | "printed" | "signed_uploaded" | "sent" | "partially_received" | "received" | "cancelled";
  orderDate: string;
  expectedArrivalDate?: string;
  totalAmount: number;
  subtotalGross?: number;
  discountTotal?: number;
  notes?: string;
  supplierEmail?: string;
  printedAt?: string | null;
  signedDocUrl?: string | null;
  signedDocName?: string | null;
  signedDocType?: string | null;
  signedDocUploadedAt?: string | null;
  sentAt?: string;
  sentTo?: string;
  items: PurchaseOrderItem[];
}

export interface NewPOItemInput {
  bookId: string;
  quantityOrdered: number;
  unitPrice: number;
  discountPercent: number;
}

export const toPrintablePo = (po: PurchaseOrder): PrintablePo => ({
  id: po.id,
  poNumber: po.poNumber,
  supplierName: po.supplierName,
  schoolName: po.schoolName,
  orderDate: po.orderDate,
  expectedArrivalDate: po.expectedArrivalDate,
  status: po.status,
  notes: po.notes,
  subtotalGross: po.subtotalGross,
  discountTotal: po.discountTotal,
  totalAmount: po.totalAmount,
  printedAt: po.printedAt,
  signedDocUrl: po.signedDocUrl,
  signedDocName: po.signedDocName,
  signedDocType: po.signedDocType,
  signedDocUploadedAt: po.signedDocUploadedAt,
  sentAt: po.sentAt,
  sentTo: po.sentTo,
  items: po.items.map((it) => ({
    title: it.title,
    isbn: it.isbn,
    quantityOrdered: it.quantityOrdered,
    quantityReceived: it.quantityReceived,
    unitPrice: it.unitPrice,
    discountPercent: it.discountPercent,
  })),
});
