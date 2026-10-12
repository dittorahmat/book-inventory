import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { schools, students, uniformOrders, uniformOrderItems, uniformPos } from "../../db/schema";
import { idSchema, academicYearSchema } from "../lib/validators";
import {
  AccessHttpError,
  accessErrorResponse,
  requireScopedActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import {
  createUniformVariant,
  createUniformPackage,
  listUniformVariants,
  listUniformPackages,
} from "../services/uniform-catalog";
import {
  createUniformPo,
  receiveUniformPo,
  assembleUniformPackages,
} from "../services/uniform-supply";
import { markUniformShipped } from "../services/uniform-orders";
import {
  listUniformExchanges,
  listUniformRefunds,
  requestUniformExchange,
  requestUniformRefund,
  resolveUniformExchange,
  resolveUniformRefund,
} from "../services/uniform-returns";

export const uniformsRouter = new Hono();

const variantSchema = z.object({
  code: z.string().min(1, "Kode varian wajib diisi"),
  name: z.string().min(1, "Nama varian wajib diisi"),
  kind: z.enum(["kain_harian", "olahraga"]),
  gender: z.enum(["male", "female"]),
  jenjang: z.enum(["tk", "sd", "smp", "sma"]),
  academicYear: academicYearSchema,
  price: z.number().int().min(0).default(0),
  sizeChartUrl: z.string().optional(),
  description: z.string().optional(),
  sizes: z.array(z.string().min(1)).default([]),
});

const uniformPackageSchema = z.object({
  code: z.string().min(1, "Kode paket wajib diisi"),
  name: z.string().min(1, "Nama paket wajib diisi"),
  academicYear: academicYearSchema,
  price: z.number().int().min(0).default(0),
  description: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: idSchema,
        size: z.string().optional(),
        quantity: z.number().int().min(1).default(1),
      })
    )
    .min(1, "Paket wajib punya minimal satu komponen"),
});

const uniformPoSchema = z.object({
  supplierId: idSchema,
  orderDate: z.string().optional(),
  notes: z.string().optional(),
  poNumber: z.string().optional(),
  lines: z
    .array(
      z.object({
        variantId: idSchema,
        size: z.string().optional(),
        quantityOrdered: z.number().int().min(1).max(500),
        unitPrice: z.number().int().min(0).default(0),
      })
    )
    .min(1, "PO wajib punya minimal satu baris"),
});

const receiveSchema = z.object({
  lines: z
    .array(
      z.object({
        variantId: idSchema,
        size: z.string().optional(),
        quantity: z.number().int().min(1).max(500),
      })
    )
    .min(1, "Penerimaan wajib punya minimal satu baris"),
});

const assembleSchema = z.object({
  quantity: z.number().int().min(1).max(500),
  sizeOverrides: z.record(z.string(), z.string().min(1)).optional(),
});

const fail = (c: { json: (body: unknown, status?: 400 | 404) => Response }, result: { status: 400 | 404; message: string }) =>
  c.json({ success: false, message: result.message }, result.status);

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
    const search = c.req.query("search")?.trim();

    const conditions = [];
    if (schoolId) conditions.push(eq(uniformOrders.schoolId, schoolId));
    if (shipmentStatus === "belum_dikirim" || shipmentStatus === "sudah_dikirim") {
      conditions.push(eq(uniformOrders.shipmentStatus, shipmentStatus));
    }
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
        totalAmount: uniformOrders.totalAmount,
        homeAddressSnapshot: uniformOrders.homeAddressSnapshot,
        createdAt: uniformOrders.createdAt,
      })
      .from(uniformOrders)
      .innerJoin(students, eq(uniformOrders.studentId, students.id))
      .innerJoin(schools, eq(uniformOrders.schoolId, schools.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(uniformOrders.createdAt))
      .limit(50);
    return c.json({ success: true, data: rows });
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

const exchangeSchema = z.object({
  orderId: idSchema,
  oldVariantId: idSchema,
  oldSize: z.string().min(1, "Size lama wajib diisi"),
  newVariantId: idSchema,
  newSize: z.string().min(1, "Size baru wajib diisi"),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

const resolveExchangeSchema = z.object({
  action: z.enum(["approve", "complete", "reject"]),
});

const refundSchema = z.object({
  orderId: idSchema,
  amount: z.number().int().min(1).optional(),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

const resolveRefundSchema = z.object({
  action: z.enum(["approve", "refund", "reject"]),
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
