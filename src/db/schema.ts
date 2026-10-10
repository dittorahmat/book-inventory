import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const schools = sqliteTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: text("type", { enum: ["main", "branch", "warehouse"] }).notNull().default("branch"),
  address: text("address"),
  phone: text("phone"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["central_admin", "warehouse_admin", "school_admin", "branch_admin"] }).notNull().default("branch_admin"),
  schoolId: text("school_id").references(() => schools.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const books = sqliteTable("books", {
  id: text("id").primaryKey(),
  isbn: text("isbn").notNull().unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  publisher: text("publisher").notNull(),
  publishYear: integer("publish_year"),
  category: text("category"),
  description: text("description"),
  coverUrl: text("cover_url"),
  price: integer("price").notNull().default(0),
  buyPrice: integer("buy_price").notNull().default(0),
  sellPrice: integer("sell_price").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bookItems = sqliteTable("book_items", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  currentSchoolId: text("current_school_id").notNull().references(() => schools.id),
  barcode: text("barcode").notNull().unique(),
  condition: text("condition", { enum: ["new", "good", "fair", "damaged"] }).notNull().default("new"),
  status: text("status", { enum: ["in_stock", "in_transit", "disposed", "lost"] }).notNull().default("in_stock"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("book_items_school_idx").on(t.currentSchoolId),
]);

export const transferShipments = sqliteTable("transfer_shipments", {
  id: text("id").primaryKey(),
  shipmentNumber: text("shipment_number").notNull().unique(),
  fromSchoolId: text("from_school_id").notNull().references(() => schools.id),
  toSchoolId: text("to_school_id").notNull().references(() => schools.id),
  status: text("status", { 
    enum: ["draft", "pending_dispatch", "in_transit", "completed", "completed_with_discrepancy", "cancelled"] 
  }).notNull().default("draft"),
  totalDeclaredValue: integer("total_declared_value").notNull().default(0),
  dispatchedAt: text("dispatched_at"),
  receivedAt: text("received_at"),
  notes: text("notes"),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("shipments_from_status_idx").on(t.fromSchoolId, t.status),
  index("shipments_to_status_idx").on(t.toSchoolId, t.status),
]);

export const transferShipmentItems = sqliteTable("transfer_shipment_items", {
  id: text("id").primaryKey(),
  shipmentId: text("shipment_id").notNull().references(() => transferShipments.id, { onDelete: "cascade" }),
  itemType: text("item_type", { enum: ["loose", "package"] }).notNull().default("loose"),
  bookItemId: text("book_item_id").references(() => bookItems.id),
  packageId: text("package_id"),
  packageItemId: text("package_item_id"),
  quantity: integer("quantity").notNull().default(1),
  unitPriceSnapshot: integer("unit_price_snapshot").notNull().default(0),
  receivedCondition: text("received_condition", { enum: ["good", "damaged", "missing"] }),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("shipment_lines_shipment_idx").on(t.shipmentId),
]);

// ==========================================
// 1. STUDENTS & ACADEMIC DATA
// ==========================================
export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  nis: text("nis").notNull(),
  name: text("name").notNull(),
  gender: text("gender", { enum: ["male", "female"] }),
  gradeLevel: text("grade_level").notNull(), // e.g., "1", "2", "7", "10"
  curriculumType: text("curriculum_type", { enum: ["international", "national"] }).notNull().default("international"),
  academicYear: text("academic_year").notNull(), // e.g. "2026/2027"
  parentName: text("parent_name"),
  parentEmail: text("parent_email"),
  parentPhone: text("parent_phone"),
  status: text("status", { enum: ["active", "promoted", "new_pending", "rejected", "graduated"] }).notNull().default("active"),
  isScholarship: integer("is_scholarship", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("students_school_status_name_idx").on(t.schoolId, t.status, t.name),
  index("students_school_nis_idx").on(t.schoolId, t.nis),
]);

// ==========================================
// 2. SUPPLIERS & PURCHASE ORDERS (LOOSE PROCUREMENT)
// ==========================================
export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: text("supplier_id").notNull().references(() => suppliers.id),
  targetSchoolId: text("target_school_id").notNull().references(() => schools.id),
  status: text("status", { enum: ["draft", "ordered", "printed", "signed_uploaded", "sent", "partially_received", "received", "cancelled"] }).notNull().default("draft"),
  orderDate: text("order_date").notNull(),
  expectedArrivalDate: text("expected_arrival_date"),
  subtotalGross: integer("subtotal_gross").notNull().default(0),
  discountTotal: integer("discount_total").notNull().default(0),
  totalAmount: integer("total_amount").notNull().default(0),
  notes: text("notes"),
  printedAt: text("printed_at"),
  signedDocUrl: text("signed_doc_url"),
  signedDocName: text("signed_doc_name"),
  signedDocType: text("signed_doc_type"),
  signedDocUploadedAt: text("signed_doc_uploaded_at"),
  sentAt: text("sent_at"),
  sentTo: text("sent_to"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("purchase_orders_target_school_idx").on(t.targetSchoolId),
]);

export const purchaseOrderItems = sqliteTable("purchase_order_items", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").notNull().default(0),
  unitPrice: integer("unit_price").notNull().default(0),
  discountPercent: integer("discount_percent").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// ==========================================
// 3. BOOK PACKAGES & BOM (KITTING / BUNDLING)
// ==========================================
export const bookPackages = sqliteTable("book_packages", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "PKG-SD1-INT"
  name: text("name").notNull(), // e.g. "Paket Kelas 1 SD Internasional"
  gradeLevel: text("grade_level").notNull(), // "1"
  curriculumType: text("curriculum_type", { enum: ["international", "national"] }).notNull().default("international"),
  academicYear: text("academic_year").notNull(), // "2026/2027"
  price: integer("price").notNull().default(0),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bookPackageItems = sqliteTable("book_package_items", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull().references(() => bookPackages.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id),
  quantity: integer("quantity").notNull().default(1),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("bom_package_idx").on(t.packageId),
]);

export const packageItems = sqliteTable("package_items", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull().references(() => bookPackages.id, { onDelete: "cascade" }),
  currentSchoolId: text("current_school_id").notNull().references(() => schools.id),
  barcode: text("barcode").notNull().unique(), // e.g. "PKG-ALW1-2026-0001"
  status: text("status", { enum: ["in_stock", "reserved", "dispatched", "delivered"] }).notNull().default("in_stock"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("package_items_school_idx").on(t.currentSchoolId),
]);

// ==========================================
// 4. STUDENT ORDERS, PAYMENTS & FULFILLMENT
// ==========================================
export const studentBookOrders = sqliteTable("student_book_orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // e.g. "ORD-202609-0001"
  studentId: text("student_id").notNull().references(() => students.id),
  schoolId: text("school_id").notNull().references(() => schools.id),
  packageId: text("package_id").references(() => bookPackages.id),
  orderType: text("order_type", { enum: ["regular", "scholarship"] }).notNull().default("regular"),
  paymentStatus: text("payment_status", { 
    enum: ["unpaid", "partial", "paid", "scholarship_pending", "scholarship_approved", "scholarship_rejected"] 
  }).notNull().default("unpaid"),
  fulfillmentStatus: text("fulfillment_status", { 
    enum: ["waiting_preparation", "ready_for_pickup", "picked_up", "return_in_progress"] 
  }).notNull().default("waiting_preparation"),
  totalAmount: integer("total_amount").notNull().default(0),
  paidAmount: integer("paid_amount").notNull().default(0),
  assignedPackageItemId: text("assigned_package_item_id").references(() => packageItems.id),
  handoverDeliveryNumber: text("handover_delivery_number"), // Surat Jalan Serah Terima
  handoverDate: text("handover_date"),
  handoverRecipient: text("handover_recipient"),
  scholarshipProofUrl: text("scholarship_proof_url"),
  financeHandoverApproved: integer("finance_handover_approved", { mode: "boolean" }).notNull().default(false),
  discountAmount: integer("discount_amount").notNull().default(0),
  discretionType: text("discretion_type", { 
    enum: ["none", "discount", "scholarship", "handover_override"] 
  }).notNull().default("none"),
  discretionNotes: text("discretion_notes"),
  discretionByUserId: text("discretion_by_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("orders_school_number_idx").on(t.schoolId, t.orderNumber),
  index("orders_school_payment_fulfillment_idx").on(t.schoolId, t.paymentStatus, t.fulfillmentStatus),
]);

export const orderPayments = sqliteTable("order_payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => studentBookOrders.id, { onDelete: "cascade" }),
  transferAmount: integer("transfer_amount").notNull(), // Total di struk bank
  bookAllocationAmount: integer("book_allocation_amount").notNull(), // Nominal yang dialokasikan khusus buku
  paymentProofUrl: text("payment_proof_url"),
  bankName: text("bank_name"),
  referenceNumber: text("reference_number"),
  verifiedByUserId: text("verified_by_user_id").references(() => users.id),
  verifiedAt: text("verified_at"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

/** Baris order satuan: satu order dapat berisi banyak judul dengan kuantitas. */
export const studentOrderItems = sqliteTable("student_order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => studentBookOrders.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id),
  quantity: integer("quantity").notNull().default(1),
  unitPriceSnapshot: integer("unit_price_snapshot").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// ==========================================
// 5. INBOUND RECEIPTS (SUPPLIER SURAT JALAN)
// ==========================================
export const purchaseOrderReceipts = sqliteTable("purchase_order_receipts", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  deliveryNoteNumber: text("delivery_note_number").notNull(), // No Surat Jalan Supplier
  receivedDate: text("received_date").notNull(),
  receivedByUserId: text("received_by_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const purchaseOrderReceiptItems = sqliteTable("purchase_order_receipt_items", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id").notNull().references(() => purchaseOrderReceipts.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id),
  quantityReceived: integer("quantity_received").notNull(),
  createdAt: text("created_at").notNull(),
});

// ==========================================
// 6. INTERNAL PO (CABANG KE GUDANG PUSAT)
// ==========================================
export const internalPurchaseOrders = sqliteTable("internal_purchase_orders", {
  id: text("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(), // e.g. "IPO-202610-0001"
  schoolId: text("school_id").notNull().references(() => schools.id), // Cabang pemesan
  status: text("status", { 
    enum: ["draft", "submitted", "processing", "partial_fulfilled", "completed", "cancelled"] 
  }).notNull().default("draft"),
  notes: text("notes"),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const internalPurchaseOrderItems = sqliteTable("internal_purchase_order_items", {
  id: text("id").primaryKey(),
  internalPoId: text("internal_po_id").notNull().references(() => internalPurchaseOrders.id, { onDelete: "cascade" }),
  packageId: text("package_id").notNull().references(() => bookPackages.id),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityFulfilled: integer("quantity_fulfilled").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const internalShipments = sqliteTable("internal_shipments", {
  id: text("id").primaryKey(),
  internalPoId: text("internal_po_id").notNull().references(() => internalPurchaseOrders.id, { onDelete: "cascade" }),
  deliveryNoteNumber: text("delivery_note_number").notNull().unique(), // Surat Jalan Pengiriman Internal
  shippedDate: text("shipped_date").notNull(),
  receivedDate: text("received_date"),
  status: text("status", { enum: ["in_transit", "delivered", "discrepancy"] }).notNull().default("in_transit"),
  shippedByUserId: text("shipped_by_user_id").references(() => users.id),
  receivedByUserId: text("received_by_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const internalShipmentItems = sqliteTable("internal_shipment_items", {
  id: text("id").primaryKey(),
  shipmentId: text("shipment_id").notNull().references(() => internalShipments.id, { onDelete: "cascade" }),
  packageId: text("package_id").references(() => bookPackages.id),
  packageItemId: text("package_item_id").references(() => packageItems.id),
  bookId: text("book_id").references(() => books.id), // untuk pengiriman outstanding / susulan satuan
  quantity: integer("quantity").notNull().default(1),
  isOutstandingFollowup: integer("is_outstanding_followup", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// ==========================================
// 7. RETURN TO VENDOR (RETUR KE SUPPLIER)
// ==========================================
export const vendorReturns = sqliteTable("vendor_returns", {
  id: text("id").primaryKey(),
  returnNumber: text("return_number").notNull().unique(), // e.g. "RTV-202610-0001"
  supplierId: text("supplier_id").notNull().references(() => suppliers.id),
  purchaseOrderId: text("purchase_order_id").references(() => purchaseOrders.id),
  status: text("status", { enum: ["draft", "submitted", "completed", "rejected"] }).notNull().default("draft"),
  reason: text("reason").notNull(),
  creditNoteAmount: integer("credit_note_amount").notNull().default(0),
  handledByUserId: text("handled_by_user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const vendorReturnItems = sqliteTable("vendor_return_items", {
  id: text("id").primaryKey(),
  vendorReturnId: text("vendor_return_id").notNull().references(() => vendorReturns.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

// ==========================================
// 8. BOOK COMPLAINTS & RETURNS / REFUNDS
// ==========================================
export const bookReturns = sqliteTable("book_returns", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => studentBookOrders.id),
  studentId: text("student_id").notNull().references(() => students.id),
  defectiveBookId: text("defective_book_id").notNull().references(() => books.id),
  replacementBookItemId: text("replacement_book_item_id").references(() => bookItems.id),
  reason: text("reason").notNull(),
  photoProofUrl: text("photo_proof_url"),
  status: text("status", { enum: ["reported", "approved", "replaced", "rejected", "refunded"] }).notNull().default("reported"),
  refundAmount: integer("refund_amount").notNull().default(0),
  handledByUserId: text("handled_by_user_id").references(() => users.id),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("returns_status_idx").on(t.status),
  index("returns_order_idx").on(t.orderId),
  index("returns_student_idx").on(t.studentId),
]);

// ==========================================
// 9. SYSTEM CONFIGURATION & SMTP / WA SETTINGS
// ==========================================
export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").notNull(),
});
