import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  studentBookOrders,
  students,
  bookPackages,
  bookReturns,
  books,
} from "../../db/schema";
import { reportReturn, resolveReturn } from "../services/return";
import { markSatuanShipped } from "../services/order-intake";
import { assertInvoiceGate, sendInvoice as sendBillingInvoice, setShipping as setBillingShipping } from "../services/order-billing";
import { applyDiscretion, cancelStudentOrder } from "../services/order-finance";
import { handoverPackage } from "../services/order-handover";
import {
  accessErrorResponse,
  loadScopedOrder,
  requireScopedActor,
} from "../services/access-scope";
import { guardScopedOrderMutation } from "../services/order-operations";
import { matchAnyLower } from "../lib/partitioned-search";
import { pendingPaymentCounts } from "../services/order-payment-review";

export const studentOrdersRouter = new Hono();

// Schema for updating fulfillment (pickup / surat jalan)
const handoverSchema = z.object({
  recipientName: z.string().min(1, "Nama penerima wajib diisi"),
  packageItemId: z.string().optional(),
  notes: z.string().optional(),
});

// Schema for book defect return report
const returnBookSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  studentId: z.string().min(1, "Student ID is required"),
  defectiveBookId: z.string().min(1, "Defective book ID is required"),
  reason: z.string().min(1, "Reason is required"),
  photoProofBase64: z.string().optional(),
});

// Schema for resolving return with replacement loose item or parent refund
const resolveReturnSchema = z.object({
  action: z.enum(["replace", "reject", "refund"]),
  replacementBookItemId: z.string().optional(),
  refundAmount: z.number().int().min(0).optional(),
  handledByUserId: z.string().optional(),
});

// 1. GET all student orders for a school with matrix filters
studentOrdersRouter.get("/", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    // Scoped actors are locked to their location; central may filter or see all.
    const schoolId = scope.length === 1 ? scope[0] : c.req.query("schoolId");
    const paymentStatus = c.req.query("paymentStatus");
  const fulfillmentStatus = c.req.query("fulfillmentStatus");
  const search = c.req.query("search");

  const conditions = [];
  if (schoolId) conditions.push(eq(studentBookOrders.schoolId, schoolId));
  if (paymentStatus && paymentStatus !== "all") conditions.push(eq(studentBookOrders.paymentStatus, paymentStatus as any));
  if (fulfillmentStatus && fulfillmentStatus !== "all") conditions.push(eq(studentBookOrders.fulfillmentStatus, fulfillmentStatus as any));
  // Pencarian Partisi (§11): substring hanya di dalam partisi terindeks.
  if (search?.trim()) {
    const matched = matchAnyLower([students.name, students.nis, studentBookOrders.orderNumber], search);
    if (matched) conditions.push(matched);
  }

  const filtered = await db
    .select({
      id: studentBookOrders.id,
      orderNumber: studentBookOrders.orderNumber,
      studentId: studentBookOrders.studentId,
      studentName: students.name,
      nis: students.nis,
      gradeLevel: students.gradeLevel,
      parentName: students.parentName,
      parentEmail: students.parentEmail,
      parentPhone: students.parentPhone,
      schoolId: studentBookOrders.schoolId,
      packageId: studentBookOrders.packageId,
      packageName: bookPackages.name,
      packageCode: bookPackages.code,
      orderType: studentBookOrders.orderType,
      paymentStatus: studentBookOrders.paymentStatus,
      fulfillmentStatus: studentBookOrders.fulfillmentStatus,
      totalAmount: studentBookOrders.totalAmount,
      paidAmount: studentBookOrders.paidAmount,
      handoverDeliveryNumber: studentBookOrders.handoverDeliveryNumber,
      handoverDate: studentBookOrders.handoverDate,
      handoverRecipient: studentBookOrders.handoverRecipient,
      homeAddressSnapshot: studentBookOrders.homeAddressSnapshot,
      satuanShipmentStatus: studentBookOrders.satuanShipmentStatus,
      satuanShippedAt: studentBookOrders.satuanShippedAt,
      shippingCost: studentBookOrders.shippingCost,
      shippingResi: studentBookOrders.shippingResi,
      invoiceSentAt: studentBookOrders.invoiceSentAt,
      scholarshipProofUrl: studentBookOrders.scholarshipProofUrl,
      notes: studentBookOrders.notes,
      createdAt: studentBookOrders.createdAt,
    })
    .from(studentBookOrders)
    .innerJoin(students, eq(studentBookOrders.studentId, students.id))
    .leftJoin(bookPackages, eq(studentBookOrders.packageId, bookPackages.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(studentBookOrders.createdAt))
    .limit(50);

  const pending = await pendingPaymentCounts(db, "buku", filtered.map((r) => r.id));
  return c.json({ success: true, data: filtered.map((r) => ({ ...r, pendingCount: pending.get(r.id) ?? 0 })) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. POST Handover Package / Generate Surat Jalan Penyerahan
studentOrdersRouter.post("/:id/handover", zValidator("json", handoverSchema), async (c) => {
  try {
    const orderId = c.req.param("id");
    const body = c.req.valid("json");

    const guard = await guardScopedOrderMutation(db, c, orderId, "paket");
    if (!guard.ok) {
      return c.json({ success: false, message: guard.message }, guard.status);
    }

    const result = await handoverPackage(db, orderId, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: "Buku berhasil diserahkan kepada murid/orang tua",
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 3. POST Report Defective Book for Return/Exchange
studentOrdersRouter.post("/returns", zValidator("json", returnBookSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    const scoped = await loadScopedOrder(db, actor, locations, body.orderId);
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }
    const result = await reportReturn(db, { ...body, source: "staff" });
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, message: "Laporan retur buku cacat berhasil disimpan", data: result.created }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 4. GET all book returns
studentOrdersRouter.get("/returns", async (c) => {
  try {
    const { scope, locations } = await requireScopedActor(db, c);
    const scopedOnly = scope.length < locations.length;
    const returnStatus = c.req.query("status");
    const returnSearch = c.req.query("search")?.trim().toLowerCase();
    // Pencarian Partisi (§11): status + substring di dalam partisi sekolah.
    const returnConditions = [];
    if (scopedOnly) returnConditions.push(inArray(studentBookOrders.schoolId, scope));
    if (returnStatus && returnStatus !== "all") returnConditions.push(eq(bookReturns.status, returnStatus as any));
    if (returnSearch) {
      const matched = matchAnyLower([students.name, students.nis, studentBookOrders.orderNumber, books.title], returnSearch);
      if (matched) returnConditions.push(matched);
    }
    const visible = await db
    .select({
      id: bookReturns.id,
      orderId: bookReturns.orderId,
      orderNumber: studentBookOrders.orderNumber,
      studentId: bookReturns.studentId,
      studentName: students.name,
      nis: students.nis,
      orderSchoolId: studentBookOrders.schoolId,
      defectiveBookId: bookReturns.defectiveBookId,
      bookTitle: books.title,
      isbn: books.isbn,
      reason: bookReturns.reason,
      photoProofUrl: bookReturns.photoProofUrl,
      status: bookReturns.status,
      replacementBookItemId: bookReturns.replacementBookItemId,
      resolvedAt: bookReturns.resolvedAt,
      createdAt: bookReturns.createdAt,
    })
    .from(bookReturns)
    .innerJoin(studentBookOrders, eq(bookReturns.orderId, studentBookOrders.id))
    .innerJoin(students, eq(bookReturns.studentId, students.id))
    .innerJoin(books, eq(bookReturns.defectiveBookId, books.id))
    .where(returnConditions.length > 0 ? and(...returnConditions) : undefined)
    .orderBy(desc(bookReturns.createdAt))
    .limit(50);

  return c.json({ success: true, data: visible });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5b. POST Tandai satuan terkirim (kirim-rumah, gudang/pusat saja, tanpa SJ-SERAH)
studentOrdersRouter.post("/:id/mark-satuan-shipped", async (c) => {
  try {
    const id = c.req.param("id");
    const guard = await guardScopedOrderMutation(db, c, id, "satuan");
    if (!guard.ok) {
      return c.json({ success: false, message: guard.message }, guard.status);
    }
    const result = await markSatuanShipped(db, id);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({
      success: true,
      message: `Satuan order ${result.data.orderNumber} ditandai sudah dikirim ke rumah.`,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5c. POST Input ongkir manual gudang (syarat tombol kirim invoice, spec satuan-invoice-wa)
const shippingSchema = z.object({
  shippingCost: z.number().int().min(0, "Ongkir wajib angka bulat >= 0"),
  shippingResi: z.string().optional(),
});

studentOrdersRouter.post("/:id/shipping", zValidator("json", shippingSchema), async (c) => {
  try {
    const id = c.req.param("id");
    const guard = await guardScopedOrderMutation(db, c, id, "satuan");
    if (!guard.ok) {
      return c.json({ success: false, message: guard.message }, guard.status);
    }
    const result = await setBillingShipping(db, id, c.req.valid("json"), "buku");
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, message: "Ongkir berhasil disimpan.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5d. POST Kirim invoice WA (gudang input ongkir dulu; tombol aktif setelah ongkir terisi)
studentOrdersRouter.post("/:id/send-invoice", async (c) => {
  try {
    const id = c.req.param("id");
    const guard = await guardScopedOrderMutation(db, c, id, "none");
    if (!guard.ok) {
      return c.json({ success: false, message: guard.message }, guard.status);
    }
    const gate = await assertInvoiceGate(db, guard.actor, id, "buku");
    if (gate) {
      return c.json({ success: false, message: gate.message }, gate.status);
    }
    const result = await sendBillingInvoice(db, id, { kind: "buku", baseUrl: new URL(c.req.url).origin });
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, message: "Invoice berhasil dikirim via WhatsApp.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5. POST Resolve Book Return (Exchange from loose stock)
studentOrdersRouter.post("/returns/:id/resolve", zValidator("json", resolveReturnSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const returnId = c.req.param("id");
    const body = c.req.valid("json");

    const [ret] = await db.select().from(bookReturns).where(eq(bookReturns.id, returnId));
    if (!ret) {
      return c.json({ success: false, message: "Laporan retur tidak ditemukan" }, 404);
    }
    const scoped = await loadScopedOrder(db, actor, locations, ret.orderId);
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }

    const result = await resolveReturn(db, returnId, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// DELETE student order (membatalkan/menghapus pesanan siswa)
studentOrdersRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const guard = await guardScopedOrderMutation(db, c, id, "none");
    if (!guard.ok) {
      return c.json({ success: false, message: guard.message }, guard.status);
    }

    const cancelled = await cancelStudentOrder(db, id);
    if (!cancelled.ok) {
      return c.json({ success: false, message: cancelled.message }, cancelled.status);
    }

    return c.json({ success: true, message: "Pesanan siswa berhasil dihapus" });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 6. POST Finance Discretion (Potong harga, Beasiswa 100%, atau Izin Ambil Handover)
const discretionSchema = z.object({
  discretionType: z.enum(["discount", "scholarship", "handover_override"]),
  discountAmount: z.number().min(0).default(0),
  discretionNotes: z.string().min(1, "Catatan/alasan diskresi finance wajib diisi"),
});

studentOrdersRouter.post("/:id/discretion", zValidator("json", discretionSchema), async (c) => {
  try {
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const guard = await guardScopedOrderMutation(db, c, id, "none");
    if (!guard.ok) {
      return c.json({ success: false, message: guard.message }, guard.status);
    }

    const applied = await applyDiscretion(db, id, body);
    if (!applied.ok) {
      return c.json({ success: false, message: applied.message }, applied.status);
    }
    const [updated] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, id));

    return c.json({
      success: true,
      message: "Diskresi Finance berhasil diterapkan pada pesanan.",
      data: updated,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});


