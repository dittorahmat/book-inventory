import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { studentBookOrders, students, bookPackages } from "../../db/schema";
import { dueOf } from "../../lib/order-money";
import {
  accessErrorResponse,
  assertLocationAllowed,
  loadLocationIds,
  loadScopedOrder,
  requireAuthenticatedActor,
  resolveRequestActor,
} from "../services/access-scope";
import {
  cashierPaymentSchema,
  listPaymentsWithStatus,
  recordCashierPayment,
  rejectPayment,
  rejectReasonSchema,
  verifyPayment,
} from "../services/order-payment-review";

export const paymentsRouter = new Hono();

// Schema for scholarship approval/rejection
const scholarshipActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
  verifiedByUserId: z.string().optional(),
});

// GET order payment history & pending claims
paymentsRouter.get("/orders/:orderId", async (c) => {
  try {
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const locations = await loadLocationIds(db);
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
        shippingCost: studentBookOrders.shippingCost,
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
    assertLocationAllowed(actor, order.schoolId, locations);

    const payments = await listPaymentsWithStatus(db, "buku", orderId);

    return c.json({
      success: true,
      data: {
        order,
        payments,
        pendingCount: payments.filter((p) => p.status === "pending").length,
        remainingAmount: Math.max(0, dueOf(order) - order.paidAmount),
      },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST record payment by cashier (manual, langsung terverifikasi)
paymentsRouter.post("/orders/:orderId/pay", zValidator("json", cashierPaymentSchema), async (c) => {
  try {
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const locations = await loadLocationIds(db);
    const orderId = c.req.param("orderId");
    const body = c.req.valid("json");

    const scoped = await loadScopedOrder(db, actor, locations, orderId);
    if (!scoped.ok) return c.json({ success: false, message: scoped.message }, scoped.status);

    const result = await recordCashierPayment(db, "buku", orderId, body);
    if (!result.ok) return c.json({ success: false, message: result.message }, result.status);

    return c.json({
      success: true,
      message: "Pembayaran berhasil diverifikasi",
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST verifikasi klaim bukti transfer orang tua (gudang)
paymentsRouter.post("/orders/:orderId/payments/:paymentId/verify", async (c) => {
  try {
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const locations = await loadLocationIds(db);
    const orderId = c.req.param("orderId");
    const scoped = await loadScopedOrder(db, actor, locations, orderId);
    if (!scoped.ok) return c.json({ success: false, message: scoped.message }, scoped.status);

    const result = await verifyPayment(db, {
      kind: "buku",
      orderId,
      paymentId: c.req.param("paymentId"),
      baseUrl: new URL(c.req.url).origin,
    });
    if (!result.ok) return c.json({ success: false, message: result.message }, result.status);

    return c.json({ success: true, message: "Pembayaran terverifikasi.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST tolak klaim bukti transfer (gudang) + kirim tautan unggah ulang
paymentsRouter.post("/orders/:orderId/payments/:paymentId/reject", zValidator("json", rejectReasonSchema), async (c) => {
  try {
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const locations = await loadLocationIds(db);
    const orderId = c.req.param("orderId");
    const scoped = await loadScopedOrder(db, actor, locations, orderId);
    if (!scoped.ok) return c.json({ success: false, message: scoped.message }, scoped.status);

    const result = await rejectPayment(db, {
      kind: "buku",
      orderId,
      paymentId: c.req.param("paymentId"),
      reason: c.req.valid("json").reason,
      baseUrl: new URL(c.req.url).origin,
    });
    if (!result.ok) return c.json({ success: false, message: result.message }, result.status);

    return c.json({ success: true, message: "Bukti pembayaran ditolak.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST approve or reject scholarship
paymentsRouter.post("/orders/:orderId/scholarship", zValidator("json", scholarshipActionSchema), async (c) => {
  try {
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const locations = await loadLocationIds(db);
    const orderId = c.req.param("orderId");
    const body = c.req.valid("json");
    const now = new Date().toISOString();

    const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
    if (!order) {
      return c.json({ success: false, message: "Pesanan tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, order.schoolId, locations);

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
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
