import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { schools, students, uniformOrders, uniformOrderItems, uniformPos } from "../../db/schema";
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
  AccessHttpError,
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
import { uniformOrderStage } from "../services/uniform/report";
import { setUniformShipping } from "../services/order-shipping";
import { sendUniformInvoice } from "../services/order-invoice";
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
    const shipmentStatus = c.req.query("shipmentStatus");
    const paymentStatus = c.req.query("paymentStatus");
    const stage = c.req.query("stage");
    const search = c.req.query("search")?.trim();

    const conditions = [];
    if (schoolId) conditions.push(eq(uniformOrders.schoolId, schoolId));
    if (shipmentStatus === "belum_dikirim" || shipmentStatus === "sudah_dikirim") {
      conditions.push(eq(uniformOrders.shipmentStatus, shipmentStatus));
    }
    if (paymentStatus === "unpaid" || paymentStatus === "partial" || paymentStatus === "paid" || paymentStatus === "scholarship_pending") {
      conditions.push(eq(uniformOrders.paymentStatus, paymentStatus));
    }
    // Tahap dipetakan ke kondisi SQL (bukan filter JS): pemesanan/tagihan/konfirmasi/lunas.
    if (stage === "pemesanan") conditions.push(isNull(uniformOrders.invoiceSentAt));
    if (stage === "tagihan") {
      conditions.push(isNotNull(uniformOrders.invoiceSentAt));
      conditions.push(eq(uniformOrders.paymentStatus, "unpaid"));
    }
    if (stage === "konfirmasi") conditions.push(eq(uniformOrders.paymentStatus, "partial"));
    if (stage === "lunas") conditions.push(eq(uniformOrders.paymentStatus, "paid"));
    if (search) {
      if (!schoolId) return c.json({ success: false, message: "Pencarian wajib disertai filter sekolah." }, 400);
      const pattern = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`lower(${students.name})`, pattern),
          like(sql`lower(${students.nis})`, pattern),
          like(sql`lower(${uniformOrders.orderNumber})`, pattern)
        )
      );
    }
    const rows = await db
      .select({
        id: uniformOrders.id,
        orderNumber: uniformOrders.orderNumber,
        studentId: uniformOrders.studentId,
        studentName: students.name,
        nis: students.nis,
        gradeLevel: students.gradeLevel,
        schoolId: uniformOrders.schoolId,
        schoolName: schools.name,
        shipmentStatus: uniformOrders.shipmentStatus,
        shippedAt: uniformOrders.shippedAt,
        shippingCost: uniformOrders.shippingCost,
        shippingResi: uniformOrders.shippingResi,
        invoiceSentAt: uniformOrders.invoiceSentAt,
        paymentStatus: uniformOrders.paymentStatus,
        orderType: uniformOrders.orderType,
        totalAmount: uniformOrders.totalAmount,
        paidAmount: uniformOrders.paidAmount,
        homeAddressSnapshot: uniformOrders.homeAddressSnapshot,
        createdAt: uniformOrders.createdAt,
      })
      .from(uniformOrders)
      .innerJoin(students, eq(uniformOrders.studentId, students.id))
      .innerJoin(schools, eq(uniformOrders.schoolId, schools.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(uniformOrders.createdAt))
      .limit(50);
    return c.json({ success: true, data: rows.map((r: (typeof rows)[number]) => ({ ...r, stage: uniformOrderStage(r) })) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Kirim invoice WA (syarat ongkir sudah diinput).
uniformsRouter.post("/orders/:id/send-invoice", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await sendUniformInvoice(db, c.req.param("id"), { baseUrl: new URL(c.req.url).origin });
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
    const result = await setUniformShipping(db, c.req.param("id"), c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Ongkir berhasil disimpan.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

const assertOrderInScope = async (scope: string[], orderId: string): Promise<void> => {
  const [o] = await db
    .select({ schoolId: uniformOrders.schoolId })
    .from(uniformOrders)
    .where(eq(uniformOrders.id, orderId));
  if (!o) return;
  if (!scope.includes(o.schoolId)) throw new AccessHttpError(403, "Akses order di luar sekolah penugasan dilarang");
};

// Detail order + baris (staf sesuai scope).
uniformsRouter.get("/orders/:id", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c);
    const orderId = c.req.param("id");
    await assertOrderInScope(scope, orderId);
    const [order] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
    if (!order) return c.json({ success: false, message: "Order seragam tidak ditemukan." }, 404);
    const items = await db
      .select()
      .from(uniformOrderItems)
      .where(eq(uniformOrderItems.orderId, orderId));
    return c.json({ success: true, data: { order, items } });
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
    await assertOrderInScope(scope, body.orderId);
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
    await assertOrderInScope(scope, body.orderId);
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
