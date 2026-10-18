import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";

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
  publicTitle: text("public_title"),
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
  status: text("status", { enum: ["in_stock", "in_transit", "disposed", "lost", "sold"] }).notNull().default("in_stock"),
  isRejected: integer("is_rejected", { mode: "boolean" }).notNull().default(false),
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
  hasTakenPackage: integer("has_taken_package", { mode: "boolean" }).notNull().default(false),
  hasTakenUniform: integer("has_taken_uniform", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("students_school_status_name_idx").on(t.schoolId, t.status, t.name),
  // NIS unik per sekolah: mencegah duplikat senyap (REG-<6 digit> dulu bisa
  // bertabrakan ~50 kali per 10rb pendaftaran portal). Nama index dipertahankan
  // agar bukti check:plans tidak berubah.
  unique("students_school_nis_idx").on(t.schoolId, t.nis),
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

/** Relasi Book–supplier banyak-ke-banyak: tanpa baris = universal (semua supplier). */
export const bookSuppliers = sqliteTable("book_suppliers", {
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  supplierId: text("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("book_suppliers_supplier_idx").on(t.supplierId),
  unique("book_suppliers_book_supplier_unq").on(t.bookId, t.supplierId),
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
  handoverDeliveryNumber: text("handover_delivery_number"), // SJ Serah-Terima (ambil langsung)
  handoverDate: text("handover_date"),
  handoverRecipient: text("handover_recipient"),
  // Kirim-Rumah Satuan (cermin seragam): snapshot alamat + flag manual gudang.
  // Paket murni -> null/belum_dikirim diabaikan; satuan kirim-rumah tanpa SJ-SERAH.
  homeAddressSnapshot: text("home_address_snapshot"),
  satuanShipmentStatus: text("satuan_shipment_status", { enum: ["belum_dikirim", "sudah_dikirim"] }).notNull().default("belum_dikirim"),
  satuanShippedAt: text("satuan_shipped_at"),
  shippingCost: integer("shipping_cost").notNull().default(0),
  shippingResi: text("shipping_resi"),
  invoiceSentAt: text("invoice_sent_at"),
  paymentToken: text("payment_token"),
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
  index("orders_school_satuan_ship_idx").on(t.schoolId, t.satuanShipmentStatus),
]);

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
  condition: text("condition", { enum: ["good", "damaged"] }).notNull().default("good"),
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
}, (t) => [
  index("internal_po_school_idx").on(t.schoolId),
]);

export const internalPurchaseOrderItems = sqliteTable("internal_purchase_order_items", {
  id: text("id").primaryKey(),
  internalPoId: text("internal_po_id").notNull().references(() => internalPurchaseOrders.id, { onDelete: "cascade" }),
  packageId: text("package_id").notNull().references(() => bookPackages.id),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityFulfilled: integer("quantity_fulfilled").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("internal_po_items_po_idx").on(t.internalPoId),
]);

export const internalShipments = sqliteTable("internal_shipments", {
  id: text("id").primaryKey(),
  internalPoId: text("internal_po_id").notNull().references(() => internalPurchaseOrders.id, { onDelete: "cascade" }),
  deliveryNoteNumber: text("delivery_note_number").notNull().unique(), // Surat Jalan Pengiriman Internal
  transferShipmentId: text("transfer_shipment_id").references(() => transferShipments.id),
  shippedDate: text("shipped_date").notNull(),
  receivedDate: text("received_date"),
  status: text("status", { enum: ["in_transit", "delivered", "discrepancy"] }).notNull().default("in_transit"),
  shippedByUserId: text("shipped_by_user_id").references(() => users.id),
  receivedByUserId: text("received_by_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("internal_shipments_transfer_idx").on(t.transferShipmentId),
  index("internal_shipments_po_idx").on(t.internalPoId),
]);

export const internalShipmentItems = sqliteTable("internal_shipment_items", {
  id: text("id").primaryKey(),
  shipmentId: text("shipment_id").notNull().references(() => internalShipments.id, { onDelete: "cascade" }),
  packageId: text("package_id").references(() => bookPackages.id),
  packageItemId: text("package_item_id").references(() => packageItems.id),
  bookId: text("book_id").references(() => books.id), // untuk pengiriman outstanding / susulan satuan
  quantity: integer("quantity").notNull().default(1),
  isOutstandingFollowup: integer("is_outstanding_followup", { mode: "boolean" }).notNull().default(false),
  receivedCondition: text("received_condition", { enum: ["good", "damaged", "missing"] }),
  receivedNotes: text("received_notes"),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("internal_shipment_line_idx").on(t.shipmentId),
]);

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

// ==========================================
// 10. UNIFORM INVENTORY (SERAGAM TERPISAH DARI BUKU)
// Kain Harian = paket kain per gender x jenjang, tanpa ukuran.
// Olahraga Jadi = pakaian jadi bersize (subset per jenjang) + size chart.
// Stok hanya di gudang pusat (kuantitas per varian-ukuran, tanpa barcode).
// ==========================================
export const uniformVariants = sqliteTable("uniform_variants", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["kain_harian", "olahraga"] }).notNull(),
  gender: text("gender", { enum: ["male", "female"] }).notNull(),
  jenjang: text("jenjang", { enum: ["tk", "sd", "smp", "sma"] }).notNull(),
  academicYear: text("academic_year").notNull(),
  price: integer("price").notNull().default(0),
  sizeChartUrl: text("size_chart_url"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("uniform_variants_kind_gender_jenjang_idx").on(t.kind, t.gender, t.jenjang),
]);

/** Subset ukuran yang diizinkan per varian (mis. TK hanya S-M dari S-10L). */
export const uniformSizes = sqliteTable("uniform_sizes", {
  id: text("id").primaryKey(),
  variantId: text("variant_id").notNull().references(() => uniformVariants.id, { onDelete: "cascade" }),
  size: text("size").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("uniform_sizes_variant_idx").on(t.variantId),
  unique("uniform_sizes_variant_size_unq").on(t.variantId, t.size),
]);

/** Stok gudang pusat: kuantitas per varian-ukuran. Kain memakai size "—". */
export const uniformStock = sqliteTable("uniform_stock", {
  id: text("id").primaryKey(),
  variantId: text("variant_id").notNull().references(() => uniformVariants.id, { onDelete: "cascade" }),
  size: text("size").notNull().default("—"),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("uniform_stock_variant_idx").on(t.variantId),
  unique("uniform_stock_variant_size_unq").on(t.variantId, t.size),
]);

export const uniformPackages = sqliteTable("uniform_packages", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  academicYear: text("academic_year").notNull(),
  price: integer("price").notNull().default(0),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const uniformPackageBom = sqliteTable("uniform_package_bom", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull().references(() => uniformPackages.id, { onDelete: "cascade" }),
  variantId: text("variant_id").notNull().references(() => uniformVariants.id),
  size: text("size").notNull().default("—"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("uniform_bom_package_idx").on(t.packageId),
]);

/** Bundel paket seragam siap kirim hasil rakitan gudang (tanpa barcode). */
export const uniformPackageStock = sqliteTable("uniform_package_stock", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull().references(() => uniformPackages.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  unique("uniform_package_stock_package_unq").on(t.packageId),
]);

export const uniformPos = sqliteTable("uniform_pos", {
  id: text("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: text("supplier_id").notNull().references(() => suppliers.id),
  status: text("status", { enum: ["draft", "ordered", "printed", "signed_uploaded", "sent", "partially_received", "received", "cancelled"] }).notNull().default("draft"),
  orderDate: text("order_date").notNull(),
  totalAmount: integer("total_amount").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("uniform_pos_supplier_idx").on(t.supplierId),
]);

export const uniformPoItems = sqliteTable("uniform_po_items", {
  id: text("id").primaryKey(),
  poId: text("po_id").notNull().references(() => uniformPos.id, { onDelete: "cascade" }),
  variantId: text("variant_id").notNull().references(() => uniformVariants.id),
  size: text("size").notNull().default("—"),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").notNull().default(0),
  unitPrice: integer("unit_price").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("uniform_po_items_po_idx").on(t.poId),
]);

/** Satu order = satu murid; satu murid boleh multi-order (tiap transaksi kiriman sendiri). */
export const uniformOrders = sqliteTable("uniform_orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  studentId: text("student_id").notNull().references(() => students.id),
  schoolId: text("school_id").notNull().references(() => schools.id),
  academicYear: text("academic_year").notNull(),
  homeAddressSnapshot: text("home_address_snapshot").notNull(),
  shipmentStatus: text("shipment_status", { enum: ["belum_dikirim", "sudah_dikirim"] }).notNull().default("belum_dikirim"),
  shippedAt: text("shipped_at"),
  shippingCost: integer("shipping_cost").notNull().default(0),
  shippingResi: text("shipping_resi"),
  invoiceSentAt: text("invoice_sent_at"),
  paymentToken: text("payment_token"),
  paymentStatus: text("payment_status", {
    enum: ["unpaid", "partial", "paid", "scholarship_pending"],
  }).notNull().default("unpaid"),
  orderType: text("order_type", { enum: ["regular", "scholarship"] }).notNull().default("regular"),
  scholarshipProofUrl: text("scholarship_proof_url"),
  totalAmount: integer("total_amount").notNull().default(0),
  paidAmount: integer("paid_amount").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("uniform_orders_school_number_idx").on(t.schoolId, t.orderNumber),
  index("uniform_orders_school_shipment_idx").on(t.schoolId, t.shipmentStatus),
  index("uniform_orders_student_idx").on(t.studentId),
]);

export const uniformOrderItems = sqliteTable("uniform_order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => uniformOrders.id, { onDelete: "cascade" }),
  packageId: text("package_id").references(() => uniformPackages.id),
  variantId: text("variant_id").references(() => uniformVariants.id),
  size: text("size").notNull().default("—"),
  quantity: integer("quantity").notNull().default(1),
  unitPriceSnapshot: integer("unit_price_snapshot").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("uniform_order_items_order_idx").on(t.orderId),
]);

/** Tukar Ukuran: exchange olahraga belum-dipakai ≤14 hari (bukan refund dana). */
export const uniformExchanges = sqliteTable("uniform_exchanges", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => uniformOrders.id),
  studentId: text("student_id").notNull().references(() => students.id),
  oldVariantId: text("old_variant_id").notNull().references(() => uniformVariants.id),
  oldSize: text("old_size").notNull(),
  newVariantId: text("new_variant_id").notNull().references(() => uniformVariants.id),
  newSize: text("new_size").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["requested", "approved", "completed", "rejected"] }).notNull().default("requested"),
  handledByUserId: text("handled_by_user_id").references(() => users.id),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("uniform_exchanges_status_idx").on(t.status),
  index("uniform_exchanges_order_idx").on(t.orderId),
]);

/** Refund Seragam: dana kembali (cacat/gagal kirim), terpisah dari tukar ukuran. */
export const uniformRefunds = sqliteTable("uniform_refunds", {
  id: text("id").primaryKey(),
  refundNumber: text("refund_number").notNull().unique(),
  orderId: text("order_id").notNull().references(() => uniformOrders.id),
  studentId: text("student_id").notNull().references(() => students.id),
  amount: integer("amount").notNull().default(0),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["requested", "approved", "refunded", "rejected"] }).notNull().default("requested"),
  handledByUserId: text("handled_by_user_id").references(() => users.id),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("uniform_refunds_order_idx").on(t.orderId),
  index("uniform_refunds_status_idx").on(t.status),
]);

/** Catatan barang reject seragam (gudang): varian-size + qty + alasan. */
export const uniformRejects = sqliteTable("uniform_rejects", {
  id: text("id").primaryKey(),
  variantId: text("variant_id").notNull().references(() => uniformVariants.id),
  size: text("size").notNull().default("—"),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("uniform_rejects_variant_idx").on(t.variantId),
]);

/** Klaim Cabang: snapshot gudang→cabang per periode+sekolah, bisa lock. */
export const branchClaims = sqliteTable("branch_claims", {
  id: text("id").primaryKey(),
  claimNumber: text("claim_number").notNull().unique(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  period: text("period").notNull(),
  status: text("status", { enum: ["draft", "locked"] }).notNull().default("draft"),
  totalQty: integer("total_qty").notNull().default(0),
  /** Nilai barang saja (tanpa ongkir). */
  goodsAmount: integer("goods_amount").notNull().default(0),
  /** Ongkir pass-through yang di-recharge ke cabang. */
  shippingAmount: integer("shipping_amount").notNull().default(0),
  /** goodsAmount + shippingAmount — total yang ditagihkan. */
  totalAmount: integer("total_amount").notNull().default(0),
  lockedAt: text("locked_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("branch_claims_school_period_idx").on(t.schoolId, t.period),
  unique("branch_claims_school_period_unq").on(t.schoolId, t.period),
]);

/**
 * Struk Bayar: satu bukti transfer bank milik murid, dicatat sekali.
 * (bank, nomor referensi) unik supaya bukti yang sama tidak dipakai dua kali;
 * referensi kosong boleh berulang karena SQLite menganggap NULL berbeda.
 */
export const paymentReceipts = sqliteTable("payment_receipts", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  schoolId: text("school_id").notNull().references(() => schools.id),
  amount: integer("amount").notNull(), // Total nominal struk, bukan hanya porsi buku
  bankName: text("bank_name").notNull(),
  referenceNumber: text("reference_number"),
  proofUrl: text("proof_url"),
  receivedAt: text("received_at").notNull(),
  verifiedByUserId: text("verified_by_user_id").references(() => users.id),
  verifiedAt: text("verified_at"),
  rejectedAt: text("rejected_at"), // pending = verifiedAt & rejectedAt null
  rejectReason: text("reject_reason"),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("payment_receipts_student_idx").on(t.studentId),
  index("payment_receipts_school_received_idx").on(t.schoolId, t.receivedAt),
  unique("payment_receipts_bank_ref_unq").on(t.bankName, t.referenceNumber),
]);

/** Alokasi: porsi satu Struk Bayar yang dibebankan ke satu order. */
export const paymentAllocations = sqliteTable("payment_allocations", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id").notNull().references(() => paymentReceipts.id, { onDelete: "cascade" }),
  // Polimorfik: mengacu ke student_book_orders atau uniform_orders sesuai `kind`.
  orderId: text("order_id").notNull(),
  kind: text("kind", { enum: ["buku", "seragam"] }).notNull(),
  amount: integer("amount").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("payment_allocations_receipt_idx").on(t.receiptId),
  index("payment_allocations_order_idx").on(t.kind, t.orderId),
]);

/**
 * Tagihan Cabang: kewajiban cabang ke gudang per order.
 * `open` sampai ongkir diinput gudang, lalu `final` dan masuk klaim periode.
 */
export const branchCharges = sqliteTable("branch_charges", {
  id: text("id").primaryKey(),
  chargeNumber: text("charge_number").notNull().unique(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  sourceType: text("source_type", { enum: ["book_order", "uniform_order"] }).notNull(),
  sourceId: text("source_id").notNull(),
  triggerEvent: text("trigger_event", { enum: ["handover", "order_created"] }).notNull(),
  chargeableAt: text("chargeable_at").notNull(),
  /** Kapan tagihan menjadi final (ongkir masuk) — periode klaim memakai ini. */
  finalizedAt: text("finalized_at"),
  goodsAmount: integer("goods_amount").notNull().default(0),
  shippingAmount: integer("shipping_amount").notNull().default(0),
  status: text("status", { enum: ["open", "final"] }).notNull().default("open"),
  claimId: text("claim_id").references(() => branchClaims.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("branch_charges_school_status_idx").on(t.schoolId, t.status),
  index("branch_charges_claim_idx").on(t.claimId),
  unique("branch_charges_source_unq").on(t.sourceType, t.sourceId),
]);
