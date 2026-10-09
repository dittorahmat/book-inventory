import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import {
  studentBookOrders,
  students,
  bookPackages,
  packageItems,
  bookItems,
  bookReturns,
  books,
} from "../../db/schema";
import { reportReturn } from "../services/return-intake";
import { handoverPackage, resolveReturn } from "../services/order-fulfilment";
import {
  accessErrorResponse,
  assertLocationAllowed,
  loadLocationIds,
  resolveLocationScope,
  resolveRequestActor,
} from "../services/access-scope";

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
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const scope = new Set(resolveLocationScope(actor, c.req.query("schoolId"), locations));
    // Scoped actors are locked to their location; central may filter or see all.
    const schoolId = scope.size === 1 ? [...scope][0] : c.req.query("schoolId");
    const paymentStatus = c.req.query("paymentStatus");
  const fulfillmentStatus = c.req.query("fulfillmentStatus");
  const search = c.req.query("search");

  const query = db
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
      scholarshipProofUrl: studentBookOrders.scholarshipProofUrl,
      notes: studentBookOrders.notes,
      createdAt: studentBookOrders.createdAt,
    })
    .from(studentBookOrders)
    .innerJoin(students, eq(studentBookOrders.studentId, students.id))
    .leftJoin(bookPackages, eq(studentBookOrders.packageId, bookPackages.id))
    .orderBy(desc(studentBookOrders.createdAt));

  const allOrders = await query;

  const filtered = allOrders.filter((o: any) => {
    if (schoolId && o.schoolId !== schoolId) return false;
    if (paymentStatus && paymentStatus !== "all" && o.paymentStatus !== paymentStatus) return false;
    if (fulfillmentStatus && fulfillmentStatus !== "all" && o.fulfillmentStatus !== fulfillmentStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        o.studentName.toLowerCase().includes(q) ||
        o.nis.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return c.json({ success: true, data: filtered });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. POST Handover Package / Generate Surat Jalan Penyerahan
studentOrdersRouter.post("/:id/handover", zValidator("json", handoverSchema), async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const orderId = c.req.param("id");
    const body = c.req.valid("json");

    const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
    if (!order) {
      return c.json({ success: false, message: "Pesanan tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, order.schoolId, locations);

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
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const body = c.req.valid("json");
    const [parentOrder] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, body.orderId));
    if (parentOrder) {
      assertLocationAllowed(actor, parentOrder.schoolId, locations);
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
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const scope = new Set(resolveLocationScope(actor, undefined, locations));
    const scopedOnly = scope.size < locations.length;
    const allReturns = await db
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
    .orderBy(desc(bookReturns.createdAt));

  const visible = scopedOnly ? allReturns.filter((r: any) => scope.has(r.orderSchoolId)) : allReturns;
  return c.json({ success: true, data: visible });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5. POST Resolve Book Return (Exchange from loose stock)
studentOrdersRouter.post("/returns/:id/resolve", zValidator("json", resolveReturnSchema), async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const returnId = c.req.param("id");
    const body = c.req.valid("json");

    const [ret] = await db.select().from(bookReturns).where(eq(bookReturns.id, returnId));
    if (!ret) {
      return c.json({ success: false, message: "Laporan retur tidak ditemukan" }, 404);
    }
    const [retOrder] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, ret.orderId));
    if (retOrder) {
      assertLocationAllowed(actor, retOrder.schoolId, locations);
    }

    // Tangani refund dana orang tua di Gudang Pusat
    if (body.action === "refund") {
      const now = new Date().toISOString();
      const refundAmt = body.refundAmount ?? 0;

      await db
        .update(bookReturns)
        .set({
          status: "refunded",
          refundAmount: refundAmt,
          handledByUserId: body.handledByUserId || null,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(bookReturns.id, returnId));

      // Kembalikan/tambah 1 stok fisik ke gudang dengan status in_stock
      const bookItemId = crypto.randomUUID();
      await db.insert(bookItems).values({
        id: bookItemId,
        bookId: ret.defectiveBookId,
        currentSchoolId: retOrder ? retOrder.schoolId : locations[0],
        barcode: `RFD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
        condition: "good",
        status: "in_stock",
        notes: `Restored to stock from parent refund (Return #${returnId})`,
        createdAt: now,
        updatedAt: now,
      });

      return c.json({
        success: true,
        message: `Permohonan refund berhasil disetujui. Dana sebesar Rp ${refundAmt.toLocaleString("id-ID")} dicatat dan 1 stok buku fisik dikembalikan ke inventaris.`,
        data: { status: "refunded", refundAmount: refundAmt, restoredBookItemId: bookItemId },
      });
    }

    const result = await resolveReturn(db, returnId, body as any);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    if (result.data.status === "replaced") {
      return c.json({
        success: true,
        message: "Penggantian buku cacat berhasil diproses",
        data: result.data,
      });
    }
    return c.json({
      success: true,
      message: "Laporan retur ditolak",
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// DELETE student order (membatalkan/menghapus pesanan siswa)
studentOrdersRouter.delete("/:id", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const id = c.req.param("id");

    const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, id));
    if (!order) {
      return c.json({ success: false, message: "Pesanan tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, order.schoolId, locations);

    // Jika order sudah di-pickup dan ada assignedPackageItemId, kembalikan status bundel ke in_stock
    if (order.assignedPackageItemId) {
      await db
        .update(packageItems)
        .set({ status: "in_stock", updatedAt: new Date().toISOString() })
        .where(eq(packageItems.id, order.assignedPackageItemId));
    }

    // Hapus laporan retur terkait jika ada
    await db.delete(bookReturns).where(eq(bookReturns.orderId, id));
    await db.delete(studentBookOrders).where(eq(studentBookOrders.id, id));

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
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, id));
    if (!order) {
      return c.json({ success: false, message: "Pesanan tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, order.schoolId, locations);

    const now = new Date().toISOString();
    let patch: Record<string, unknown> = {
      discretionType: body.discretionType,
      discretionNotes: body.discretionNotes,
      discretionByUserId: null,
      updatedAt: now,
    };

    if (body.discretionType === "scholarship") {
      patch = {
        ...patch,
        orderType: "scholarship",
        totalAmount: 0,
        paymentStatus: "scholarship_approved",
        financeHandoverApproved: true,
      };
    } else if (body.discretionType === "discount") {
      const newTotal = Math.max(0, order.totalAmount - body.discountAmount);
      patch = {
        ...patch,
        discountAmount: body.discountAmount,
        totalAmount: newTotal,
        paymentStatus: order.paidAmount >= newTotal ? "paid" : "partial",
      };
    } else if (body.discretionType === "handover_override") {
      patch = {
        ...patch,
        financeHandoverApproved: true,
      };
    }

    await db.update(studentBookOrders).set(patch as any).where(eq(studentBookOrders.id, id));
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


