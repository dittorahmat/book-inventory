import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { uniformOrders, uniformOrderItems, uniformPos } from "../../db/schema";
import {
  assembleSchema,
  claimSchema,
  exchangeSchema,
  receiveSchema,
  refundSchema,
  resolveExchangeSchema,
  resolveRefundSchema,
  uniformPackageSchema,
  uniformPoSchema,
  variantSchema,
} from "../lib/uniform-schemas";
import {
  accessErrorResponse,
  requireScopedActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import {
  assembleUniformPackages,
  createUniformClaim,
  createUniformPackage,
  createUniformPo,
  createUniformVariant,
  getUniformSalesReport,
  listUniformExchanges,
  listUniformPackages,
  listUniformRefunds,
  listUniformVariants,
  lockUniformClaim,
  listUniformClaims,
  markUniformShipped,
  receiveUniformPo,
  requestUniformExchange,
  requestUniformRefund,
  resolveUniformExchange,
  resolveUniformRefund,
} from "../services/uniform";
import { sendInvoice as sendBillingInvoice, setShipping as setBillingShipping } from "../services/order-billing";
import { listUniformOrders, assertUniformOrderInScope } from "../services/uniform/orders";
import {
  cashierPaymentSchema,
  listPaymentsWithStatus,
  recordCashierPayment,
  rejectPayment,
  rejectReasonSchema,
  verifyPayment,
} from "../services/order-payment-review";
import { fail } from "../lib/route-fail";

export const uniformsRouter = new Hono();

uniformsRouter.get("/variants", async (c) => {
  try {
    await requireScopedActor(db, c);
    return c.json({ success: true, data: await listUniformVariants(db) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/variants", zValidator("json", variantSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await createUniformVariant(db, c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.get("/packages", async (c) => {
  try {
    await requireScopedActor(db, c);
    return c.json({ success: true, data: await listUniformPackages(db) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/packages", zValidator("json", uniformPackageSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await createUniformPackage(db, c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/packages/:id/assemble", zValidator("json", assembleSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const { quantity, sizeOverrides } = c.req.valid("json");
    const result = await assembleUniformPackages(db, c.req.param("id"), quantity, sizeOverrides);
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.get("/pos", async (c) => {
  try {
    await requireScopedActor(db, c);
    const rows = await db.select().from(uniformPos).orderBy(desc(uniformPos.createdAt)).limit(50);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/pos", zValidator("json", uniformPoSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await createUniformPo(db, c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/pos/:id/receive", zValidator("json", receiveSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await receiveUniformPo(db, c.req.param("id"), c.req.valid("json").lines);
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Daftar order seragam: filter sekolah + status kirim + cari (cari wajib dalam sekolah).
uniformsRouter.get("/orders", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = scope.length === 1 ? scope[0] : c.req.query("schoolId");
    const search = c.req.query("search")?.trim();
    if (search && !schoolId) return c.json({ success: false, message: "Pencarian wajib disertai filter sekolah." }, 400);
    const data = await listUniformOrders(db, {
      schoolId,
      shipmentStatus: c.req.query("shipmentStatus"),
      paymentStatus: c.req.query("paymentStatus"),
      stage: c.req.query("stage"),
      search,
    });
    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Kirim invoice WA (syarat ongkir sudah diinput).
uniformsRouter.post("/orders/:id/send-invoice", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await sendBillingInvoice(db, c.req.param("id"), { kind: "seragam", baseUrl: new URL(c.req.url).origin });
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Invoice berhasil dikirim via WhatsApp.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Tandai terkirim (gudang/pusat saja).
uniformsRouter.post("/orders/:id/ship", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await markUniformShipped(db, c.req.param("id"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Input ongkir manual gudang (syarat tombol kirim invoice).
uniformsRouter.post("/orders/:id/shipping", zValidator("json", z.object({
  shippingCost: z.number().int().min(0, "Ongkir wajib angka bulat >= 0"),
  shippingResi: z.string().optional(),
})), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await setBillingShipping(db, c.req.param("id"), c.req.valid("json"), "seragam");
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Ongkir berhasil disimpan.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Kasir manual seragam (uang diterima langsung): baris auto-verified.
uniformsRouter.post("/orders/:id/pay", zValidator("json", cashierPaymentSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await recordCashierPayment(db, "seragam", c.req.param("id"), c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Pembayaran kasir tercatat & terverifikasi.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Verifikasi klaim bukti transfer seragam (gudang).
uniformsRouter.post("/orders/:id/payments/:paymentId/verify", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await verifyPayment(db, {
      kind: "seragam",
      orderId: c.req.param("id"),
      paymentId: c.req.param("paymentId"),
      baseUrl: new URL(c.req.url).origin,
    });
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Pembayaran terverifikasi.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Tolak klaim bukti transfer seragam (gudang) + kirim tautan unggah ulang.
uniformsRouter.post("/orders/:id/payments/:paymentId/reject", zValidator("json", rejectReasonSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await rejectPayment(db, {
      kind: "seragam",
      orderId: c.req.param("id"),
      paymentId: c.req.param("paymentId"),
      reason: c.req.valid("json").reason,
      baseUrl: new URL(c.req.url).origin,
    });
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Bukti pembayaran ditolak.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Detail order + baris (staf sesuai scope).
uniformsRouter.get("/orders/:id", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c);
    const orderId = c.req.param("id");
    await assertUniformOrderInScope(db, scope, orderId);
    const [order] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
    if (!order) return c.json({ success: false, message: "Order seragam tidak ditemukan." }, 404);
    const items = await db
      .select()
      .from(uniformOrderItems)
      .where(eq(uniformOrderItems.orderId, orderId));
    const payments = await listPaymentsWithStatus(db, "seragam", orderId);
    return c.json({
      success: true,
      data: { order, items, payments, pendingCount: payments.filter((p) => p.status === "pending").length },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.get("/exchanges", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = scope.length === 1 ? scope[0] : c.req.query("schoolId");
    const status = c.req.query("status") || undefined;
    return c.json({ success: true, data: await listUniformExchanges(db, schoolId, status) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/exchanges", zValidator("json", exchangeSchema), async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    await assertUniformOrderInScope(db, scope, body.orderId);
    const result = await requestUniformExchange(db, body);
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/exchanges/:id/resolve", zValidator("json", resolveExchangeSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await resolveUniformExchange(db, c.req.param("id"), c.req.valid("json").action);
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.get("/refunds", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = scope.length === 1 ? scope[0] : c.req.query("schoolId");
    const status = c.req.query("status") || undefined;
    return c.json({ success: true, data: await listUniformRefunds(db, schoolId, status) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/refunds", zValidator("json", refundSchema), async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    await assertUniformOrderInScope(db, scope, body.orderId);
    const result = await requestUniformRefund(db, body);
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/refunds/:id/resolve", zValidator("json", resolveRefundSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await resolveUniformRefund(db, c.req.param("id"), c.req.valid("json").action);
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Laporan penjualan seragam (terpisah dari buku): sekolah × jenjang × ukuran.
uniformsRouter.get("/reports/sales", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const queried = c.req.query("schoolId");
    const schoolIds = scope.length === 1 ? scope : queried ? [queried] : scope;
    const today = new Date().toISOString().slice(0, 10);
    const report = await getUniformSalesReport({
      database: db,
      from: c.req.query("from") || `${today.slice(0, 7)}-01`,
      to: c.req.query("to") || today,
      schoolIds,
      jenjang: c.req.query("jenjang") || undefined,
      size: c.req.query("size") || undefined,
      gender: c.req.query("gender") || undefined,
      paymentStatus: c.req.query("paymentStatus") || undefined,
      shipmentStatus: c.req.query("shipmentStatus") || undefined,
    });
    return c.json({ success: true, data: report });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.get("/claims", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = scope.length === 1 ? scope[0] : c.req.query("schoolId");
    return c.json({ success: true, data: await listUniformClaims(db, schoolId) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/claims", zValidator("json", claimSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await createUniformClaim(db, c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.post("/claims/:id/lock", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await lockUniformClaim(db, c.req.param("id"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
