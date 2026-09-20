export interface School {
  id: string;
  name: string;
  code: string;
  type: "main" | "branch";
  address?: string;
  phone?: string;
}

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishYear?: number;
  category?: string;
  description?: string;
  coverUrl?: string;
}

export interface BookItem {
  id: string;
  barcode: string;
  condition: "new" | "good" | "fair" | "damaged";
  status: "in_stock" | "in_transit" | "disposed" | "lost";
  notes?: string;
  createdAt: string;
  book?: Book;
  school?: School;
}

export interface TransferShipment {
  id: string;
  shipmentNumber: string;
  fromSchoolId: string;
  toSchoolId: string;
  status: "draft" | "pending_dispatch" | "in_transit" | "completed" | "completed_with_discrepancy" | "cancelled";
  dispatchedAt?: string;
  receivedAt?: string;
  notes?: string;
  createdAt: string;
  fromSchool?: School;
  toSchool?: School;
  items?: Array<{
    id: string;
    bookItemId: string;
    receivedCondition?: string;
    barcode?: string;
    bookTitle?: string;
  }>;
}
