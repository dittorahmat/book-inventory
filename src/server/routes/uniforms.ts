import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { uniformOrders, uniformOrderItems, uniformPos, uniformExchanges } from "../../db/schema";
import {
  assembleSchema,
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
  createUniformPackage,
  createUniformPo,
  createUniformVariant,
  getUniformSalesReport,
  listUniformExchanges,
  listUniformPackages,
  listUniformRefunds,
  listUniformVariants,
  markUniformShipped,
  receiveUniformPo,
  requestUniformExchange,
  requestUniformRefund,
  resolveUniformExchange,
  resolveUniformRefund,
} from "../services/uniform";
import { approveUniformWithdrawal } from "../services/uniform-withdrawal";
import { findRefundSlip } from "../services/refund-slip";
import { listUniformOrders, assertUniformOrderInScope } from "../services/uniform/order-query";
import { listPaymentsWithStatus } from "../services/order-payment-review";
import { fail } from "../lib/route-fail";

import { uniformOrderActionsRouter } from "./uniform-order-actions";

export const uniformsRouter = new Hono();
uniformsRouter.route("/", uniformOrderActionsRouter);

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

import {
  reviewSportsExchange,
  getSportsExchangeDetails,
  checkReplacementStock,
} from "../services/uniform-sports-exchange";

uniformsRouter.post("/exchanges/:id/resolve", zValidator("json", resolveExchangeSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
    if (body.action === "approve_ready" || body.action === "approve_backorder") {
      const res = await reviewSportsExchange(db, {
        exchangeId: c.req.param("id"),
        action: body.action,
        replacementResi: body.replacementResi,
        estimatedShipDate: body.estimatedShipDate,
      });
      if (!res.ok) return c.json({ success: false, message: res.message }, res.status);
      return c.json({ success: true, data: res.data, details: res.details, message: res.message });
    }
    const result = await resolveUniformExchange(db, c.req.param("id"), body.action);
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.get("/exchanges/:id/check-stock", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const exId = c.req.param("id");
    const [ex] = await db.select().from(uniformExchanges).where(eq(uniformExchanges.id, exId));
    if (!ex) return c.json({ success: false, message: "Pengajuan tukar tidak ditemukan" }, 404);
    const stockInfo = await checkReplacementStock(db, ex.newVariantId, ex.newSize);
    const details = await getSportsExchangeDetails(db, exId);
    return c.json({ success: true, data: { ...stockInfo, details: details ?? {} } });
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

// Approval seragam murid mundur & restock gudang pusat (ADR-0019)
uniformsRouter.post("/refunds/:id/approve-withdrawal", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await approveUniformWithdrawal(db, c.req.param("id"));
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, message: result.message, data: result.slip });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.get("/withdrawal-slip/:slipNumber", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const slip = await findRefundSlip(db, c.req.param("slipNumber"));
    if (!slip) return c.json({ success: false, message: "Slip bukti pengembalian seragam tidak ditemukan" }, 404);
    return c.json({ success: true, data: slip });
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


