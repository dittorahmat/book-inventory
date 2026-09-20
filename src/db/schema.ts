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
  schoolId: text("school_id").references(() => schools.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["central_admin", "branch_admin"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
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
