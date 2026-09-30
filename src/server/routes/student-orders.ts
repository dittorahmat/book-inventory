import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import { 
  studentBookOrders, 
  students, 
  bookPackages, 
  packageItems, 
  bookReturns, 
  books, 
  bookItems 
} from "../../db/schema";
import { defaultStorage } from "../../services/storage";
import { decodeBase64ToBytes } from "../base64";
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

// Schema for resolving return with replacement loose item
const resolveReturnSchema = z.object({
  action: z.enum(["replace", "reject"]),
  replacementBookItemId: z.string().optional(),
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
    const now = new Date().toISOString();

    const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
    if (!order) {
      return c.json({ success: false, message: "Pesanan tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, order.schoolId, locations);

  // Generate unique Surat Jalan Delivery Number
  const deliveryNumber = `SJ-SERAH-${Date.now().toString().slice(-8)}`;

  // Find or use package item
  let assignedItem = body.packageItemId;
  if (!assignedItem && order.packageId) {
    const [availableBundle] = await db
      .select()
      .from(packageItems)
      .where(
        and(
          eq(packageItems.packageId, order.packageId),
          eq(packageItems.currentSchoolId, order.schoolId),
          eq(packageItems.status, "in_stock")
        )
      )
      .limit(1);

    if (availableBundle) {
      assignedItem = availableBundle.id;
      // Mark bundle delivered
      await db
        .update(packageItems)
        .set({ status: "delivered", updatedAt: now })
        .where(eq(packageItems.id, availableBundle.id));
    }
  }

  await db
    .update(studentBookOrders)
    .set({
      fulfillmentStatus: "picked_up",
      handoverDeliveryNumber: deliveryNumber,
      handoverDate: now,
      handoverRecipient: body.recipientName,
      assignedPackageItemId: assignedItem || null,
      notes: body.notes ? `${order.notes || ""} [Handover: ${body.notes}]`.trim() : order.notes,
      updatedAt: now,
    })
    .where(eq(studentBookOrders.id, orderId));

  return c.json({
    success: true,
    message: "Buku berhasil diserahkan kepada murid/orang tua",
    data: {
      orderId,
      deliveryNumber,
      handoverDate: now,
      handoverRecipient: body.recipientName,
      fulfillmentStatus: "picked_up",
    },
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
  const now = new Date().toISOString();
  const returnId = crypto.randomUUID();

  let photoProofUrl: string | null = null;
  if (body.photoProofBase64) {
    const key = `returns/${returnId}_${Date.now()}.jpg`;
    const buffer = decodeBase64ToBytes(body.photoProofBase64);
    photoProofUrl = await defaultStorage.upload(key, buffer, "image/jpeg");
  }

  await db.insert(bookReturns).values({
    id: returnId,
    orderId: body.orderId,
    studentId: body.studentId,
    defectiveBookId: body.defectiveBookId,
    reason: body.reason,
    photoProofUrl,
    status: "reported",
    createdAt: now,
    updatedAt: now,
  });

  // Flag order as return in progress
  await db
    .update(studentBookOrders)
    .set({ fulfillmentStatus: "return_in_progress", updatedAt: now })
    .where(eq(studentBookOrders.id, body.orderId));

  const [created] = await db.select().from(bookReturns).where(eq(bookReturns.id, returnId));
  return c.json({ success: true, message: "Laporan retur buku cacat berhasil disimpan", data: created }, 201);
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
    const now = new Date().toISOString();

    const [ret] = await db.select().from(bookReturns).where(eq(bookReturns.id, returnId));
    if (!ret) {
      return c.json({ success: false, message: "Laporan retur tidak ditemukan" }, 404);
    }
    const [retOrder] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, ret.orderId));
    if (retOrder) {
      assertLocationAllowed(actor, retOrder.schoolId, locations);
    }

  if (body.action === "replace") {
    // If replacement item not provided, pick available loose stock
    let replacementId = body.replacementBookItemId;
    if (!replacementId) {
      const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, ret.orderId));
      if (order) {
        const [availableLoose] = await db
          .select()
          .from(bookItems)
          .where(
            and(
              eq(bookItems.bookId, ret.defectiveBookId),
              eq(bookItems.currentSchoolId, order.schoolId),
              eq(bookItems.status, "in_stock"),
              eq(bookItems.condition, "new")
            )
          )
          .limit(1);

        if (availableLoose) {
          replacementId = availableLoose.id;
          // Mark loose item given to student
          await db
            .update(bookItems)
            .set({ status: "disposed", notes: `Replaced defective book return ${returnId}`, updatedAt: now })
            .where(eq(bookItems.id, availableLoose.id));
        }
      }
    }

    await db
      .update(bookReturns)
      .set({
        status: "replaced",
        replacementBookItemId: replacementId || null,
        handledByUserId: body.handledByUserId || null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(bookReturns.id, returnId));

    // Restore order to picked_up
    await db
      .update(studentBookOrders)
      .set({ fulfillmentStatus: "picked_up", updatedAt: now })
      .where(eq(studentBookOrders.id, ret.orderId));

    return c.json({ success: true, message: "Penggantian buku cacat berhasil diproses" });
  } else {
    await db
      .update(bookReturns)
      .set({
        status: "rejected",
        handledByUserId: body.handledByUserId || null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(bookReturns.id, returnId));

    return c.json({ success: true, message: "Laporan retur ditolak" });
  }
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
