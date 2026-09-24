import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const schools = sqliteTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: text("type", { enum: ["main", "branch"] }).notNull().default("branch"),
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
  role: text("role", { enum: ["central_admin", "branch_admin"] }).notNull().default("branch_admin"),
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
});

export const transferShipments = sqliteTable("transfer_shipments", {
  id: text("id").primaryKey(),
  shipmentNumber: text("shipment_number").notNull().unique(),
  fromSchoolId: text("from_school_id").notNull().references(() => schools.id),
  toSchoolId: text("to_school_id").notNull().references(() => schools.id),
  status: text("status", { 
    enum: ["draft", "pending_dispatch", "in_transit", "completed", "completed_with_discrepancy", "cancelled"] 
  }).notNull().default("draft"),
  dispatchedAt: text("dispatched_at"),
  receivedAt: text("received_at"),
  notes: text("notes"),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const transferShipmentItems = sqliteTable("transfer_shipment_items", {
  id: text("id").primaryKey(),
  shipmentId: text("shipment_id").notNull().references(() => transferShipments.id, { onDelete: "cascade" }),
  bookItemId: text("book_item_id").notNull().references(() => bookItems.id),
  receivedCondition: text("received_condition", { enum: ["good", "damaged", "missing"] }),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

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
  status: text("status", { enum: ["active", "promoted", "new_pending", "graduated"] }).notNull().default("active"),
  isScholarship: integer("is_scholarship", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

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
  status: text("status", { enum: ["draft", "ordered", "partially_received", "received", "cancelled"] }).notNull().default("draft"),
  orderDate: text("order_date").notNull(),
  expectedArrivalDate: text("expected_arrival_date"),
  totalAmount: integer("total_amount").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const purchaseOrderItems = sqliteTable("purchase_order_items", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").notNull().default(0),
  unitPrice: integer("unit_price").notNull().default(0),
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
});

export const packageItems = sqliteTable("package_items", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull().references(() => bookPackages.id, { onDelete: "cascade" }),
  currentSchoolId: text("current_school_id").notNull().references(() => schools.id),
  barcode: text("barcode").notNull().unique(), // e.g. "PKG-ALW1-2026-0001"
  status: text("status", { enum: ["in_stock", "reserved", "dispatched", "delivered"] }).notNull().default("in_stock"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

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
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

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

// ==========================================
// 5. BOOK COMPLAINTS & RETURNS (DEFECT EXCHANGE)
// ==========================================
export const bookReturns = sqliteTable("book_returns", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => studentBookOrders.id),
  studentId: text("student_id").notNull().references(() => students.id),
  defectiveBookId: text("defective_book_id").notNull().references(() => books.id),
  replacementBookItemId: text("replacement_book_item_id").references(() => bookItems.id),
  reason: text("reason").notNull(),
  photoProofUrl: text("photo_proof_url"),
  status: text("status", { enum: ["reported", "approved", "replaced", "rejected"] }).notNull().default("reported"),
  handledByUserId: text("handled_by_user_id").references(() => users.id),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ==========================================
// 6. SYSTEM CONFIGURATION & SMTP SETTINGS
// ==========================================
export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").notNull(),
});
