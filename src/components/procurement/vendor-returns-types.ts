export interface VendorReturnItem {
  id: string;
  vendorReturnId: string;
  bookId: string;
  bookTitle: string;
  isbn: string;
  quantity: number;
  reason?: string | null;
}

export interface VendorReturn {
  id: string;
  returnNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string | null;
  status: "draft" | "completed";
  reason: string;
  creditNoteAmount: number;
  createdAt: string;
  updatedAt: string;
  items: VendorReturnItem[];
}

export interface CreateVendorReturnInput {
  supplierId: string;
  purchaseOrderId?: string;
  reason: string;
  creditNoteAmount: number;
  items: {
    bookId: string;
    quantity: number;
    reason?: string;
  }[];
}
