import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { studentBookOrders, orderPayments, students, bookPackages } from "../../db/schema";

export const paymentsRouter = new Hono();

// Schema for manual cashier payment entry
const cashierPaymentSchema = z.object({
  transferAmount: z.number().int().min(1, "Nominal transfer wajib diisi"),
  bookAllocationAmount: z.number().int().min(1, "Nominal alokasi buku wajib diisi"),
  bankName: z.string().optional(),
  referenceNumber: z.string().optional(),
  verifiedByUserId: z.string().optional(),
  notes: z.string().optional(),
});

// Schema for scholarship approval/rejection
const scholarshipActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
  verifiedByUserId: z.string().optional(),
});

// GET order payment history & pending approvals
paymentsRouter.get("/orders/:orderId", async (c) => {
  const orderId = c.req.param("orderId");

  const [order] = await db
    .select({
      id: studentBookOrders.id,
      orderNumber: studentBookOrders.orderNumber,
      studentId: studentBookOrders.studentId,
      studentName: students.name,
      nis: students.nis,
      schoolId: studentBookOrders.schoolId,
      packageId: studentBookOrders.packageId,
      packageName: bookPackages.name,
      orderType: studentBookOrders.orderType,
      paymentStatus: studentBookOrders.paymentStatus,
      fulfillmentStatus: studentBookOrders.fulfillmentStatus,
      totalAmount: studentBookOrders.totalAmount,
      paidAmount: studentBookOrders.paidAmount,
      scholarshipProofUrl: studentBookOrders.scholarshipProofUrl,
      notes: studentBookOrders.notes,
      createdAt: studentBookOrders.createdAt,
    })
    .from(studentBookOrders)
    .innerJoin(students, eq(studentBookOrders.studentId, students.id))
    .leftJoin(bookPackages, eq(studentBookOrders.packageId, bookPackages.id))
    .where(eq(studentBookOrders.id, orderId));

  if (!order) {
    return c.json({ success: false, message: "Pesanan tidak ditemukan" }, 404);
  }

  const payments = await db
    .select()
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId))
    .orderBy(desc(orderPayments.createdAt));

  return c.json({
    success: true,
    data: {
      order,
      payments,
      remainingAmount: Math.max(0, order.totalAmount - order.paidAmount),
    },
  });
});

// POST record payment by cashier (Partial or Full)
paymentsRouter.post("/orders/:orderId/pay", zValidator("json", cashierPaymentSchema), async (c) => {
  const orderId = c.req.param("orderId");
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) {
    return c.json({ success: false, message: "Pesanan tidak ditemukan" }, 404);
  }

  const newPaidAmount = order.paidAmount + body.bookAllocationAmount;
  const newPaymentStatus = newPaidAmount >= order.totalAmount ? "paid" : "partial";

  // Insert payment record
  await db.insert(orderPayments).values({
    id: crypto.randomUUID(),
    orderId,
    transferAmount: body.transferAmount,
    bookAllocationAmount: body.bookAllocationAmount,
    bankName: body.bankName || "Cash/Manual Transfer",
    referenceNumber: body.referenceNumber || null,
    verifiedByUserId: body.verifiedByUserId || null,
    verifiedAt: now,
    notes: body.notes || null,
    createdAt: now,
  });

  // Update order
  await db
    .update(studentBookOrders)
    .set({
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus,
      updatedAt: now,
    })
    .where(eq(studentBookOrders.id, orderId));

  return c.json({
    success: true,
    message: "Pembayaran berhasil diverifikasi",
    data: {
      orderId,
      paidAmount: newPaidAmount,
      remainingAmount: Math.max(0, order.totalAmount - newPaidAmount),
      paymentStatus: newPaymentStatus,
    },
  });
});

// POST approve or reject scholarship
paymentsRouter.post("/orders/:orderId/scholarship", zValidator("json", scholarshipActionSchema), async (c) => {
  const orderId = c.req.param("orderId");
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) {
    return c.json({ success: false, message: "Pesanan tidak ditemukan" }, 404);
  }

  if (order.orderType !== "scholarship") {
    return c.json({ success: false, message: "Pesanan ini bukan pesanan jalur beasiswa" }, 400);
  }

  const newStatus = body.action === "approve" ? "scholarship_approved" : "scholarship_rejected";

  await db
    .update(studentBookOrders)
    .set({
      paymentStatus: newStatus,
      notes: body.notes ? `${order.notes || ""} [Beasiswa ${body.action}: ${body.notes}]`.trim() : order.notes,
      updatedAt: now,
    })
    .where(eq(studentBookOrders.id, orderId));

  return c.json({
    success: true,
    message: `Permohonan beasiswa berhasil di-${body.action === "approve" ? "setujui" : "tolak"}`,
    data: {
      orderId,
      paymentStatus: newStatus,
    },
  });
});
