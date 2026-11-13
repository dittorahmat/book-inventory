import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { uniformOrders, uniformOrderItems, uniformPos, uniformExchanges } from "../../db/schema";
import { base64UploadSchema } from "../lib/validators";
import {
  assembleSchema,
  exchangeSchema,
  receiveSchema,
  refundSchema,
  resolveExchangeSchema,
  resolveRefundSchema,
  uniformPackageSchema,
  uniformPoSchema,
  updateUniformPackageSchema,
  updateVariantSchema,
  variantSchema,
} from "../lib/uniform-schemas";
import {
  accessErrorResponse,
  requireScopedActor,
  resolveLogisticsActor,
  LOGISTICS_ROLES,
} from "../services/access-scope";
import {
  assembleUniformPackages,
  createUniformPackage,
  createUniformPo,
  createUniformVariant,
  deleteUniformPackage,
  deleteUniformVariant,
  listUniformExchanges,
  listUniformPackages,
  listUniformRefunds,
  listUniformVariants,
  markUniformShipped,
  receiveUniformPo,
  requestUniformExchange,
  requestUniformRefund,
  checkReplacementStock,
  resolveUniformExchange,
  resolveUniformRefund,
  updateUniformPackage,
  updateUniformVariant,
} from "../services/uniform";
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

uniformsRouter.put("/variants/:id", zValidator("json", updateVariantSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await updateUniformVariant(db, c.req.param("id"), c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.delete("/variants/:id", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await deleteUniformVariant(db, c.req.param("id"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
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

uniformsRouter.put("/packages/:id", zValidator("json", updateUniformPackageSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await updateUniformPackage(db, c.req.param("id"), c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformsRouter.delete("/packages/:id", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await deleteUniformPackage(db, c.req.param("id"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
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

// Daftar order seragam: filter sekolah + status kirim + cari (cari wajib dalam sekolah untuk role non-global).
uniformsRouter.get("/orders", async (c) => {
  try {
    const { actor, scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const isGlobal = actor && (actor.role === "central_admin" || LOGISTICS_ROLES.includes(actor.role));
    const schoolId = !isGlobal && scope.length === 1 ? scope[0] : c.req.query("schoolId");
    const search = c.req.query("search")?.trim();
    if (search && !schoolId && !isGlobal) {
      return c.json({ success: false, message: "Pencarian wajib disertai filter sekolah." }, 400);
    }
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
const shipOrderSchema = z.object({
  shippingResi: z.string().optional(),
  packagePhotoBase64: base64UploadSchema,
}).optional();

uniformsRouter.post("/orders/:id/ship", zValidator("json", shipOrderSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
    const result = await markUniformShipped(db, c.req.param("id"), body);
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


uniformsRouter.post("/exchanges/:id/resolve", zValidator("json", resolveExchangeSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
    const decision =
      body.action === "approve_ready"
        ? "ready"
        : body.action === "approve_backorder"
          ? "backorder"
          : body.action;
    const res = await resolveUniformExchange(db, {
      exchangeId: c.req.param("id"),
      decision,
      replacementResi: body.replacementResi,
      estimatedShipDate: body.estimatedShipDate,
    });
    if (!res.ok) return fail(c, res);
    return c.json({
      success: true,
      data: res.data,
      // Bentuk respons lama dipertahankan: detail pelacakan kini dibaca dari baris.
      details: {
        courierResi: res.data.courierResi ?? undefined,
        replacementResi: res.data.replacementResi ?? undefined,
        estimatedShipDate: res.data.estimatedShipDate ?? undefined,
      },
      message: res.message,
    });
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
    const details = {
      courierResi: ex.courierResi ?? undefined,
      replacementResi: ex.replacementResi ?? undefined,
      estimatedShipDate: ex.estimatedShipDate ?? undefined,
    };
    return c.json({ success: true, data: { ...stockInfo, details } });
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


