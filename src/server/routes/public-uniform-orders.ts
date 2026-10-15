import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, like, notInArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { schools, students, uniformOrders, uniformOrderItems } from "../../db/schema";
import { idSchema, academicYearSchema } from "../lib/validators";
import {
  listUniformPackages,
  listUniformVariants,
  requestUniformExchange,
  requestUniformRefund,
  submitUniformOrder,
} from "../services/uniform";

export const publicUniformOrdersRouter = new Hono();

const searchStudentSchema = z.object({
  query: z.string().min(2, "Minimal 2 karakter untuk pencarian"),
  schoolId: idSchema,
});

const catalogQuerySchema = z.object({
  academicYear: academicYearSchema,
});

const orderItemSchema = z.object({
  packageId: idSchema.optional(),
  variantId: idSchema.optional(),
  size: z.string().optional(),
  quantity: z.number().int().min(1).max(50).default(1),
});

const submitUniformOrderSchema = z
  .object({
    studentId: idSchema,
    academicYear: academicYearSchema,
    homeAddress: z.string().min(10, "Alamat rumah wajib diisi lengkap untuk pengiriman"),
    items: z.array(orderItemSchema).min(1, "Pilih minimal satu paket atau satuan"),
    sizeOverrides: z.record(z.string(), z.string().min(1)).optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.items.every((i) => (i.packageId ? 1 : 0) + (i.variantId ? 1 : 0) === 1), {
    message: "Tiap baris wajib paket atau satuan, bukan keduanya",
  });

const lookupQuerySchema = z
  .object({
    orderNumber: z.string().min(3, "Minimal 3 karakter").optional(),
    studentId: idSchema.optional(),
    schoolId: idSchema.optional(),
  })
  .refine((v) => v.orderNumber || v.studentId, { message: "Isi nomor order atau pilih murid" });

// Cari murid terverifikasi dalam satu sekolah (Pencarian Partisi §11).
publicUniformOrdersRouter.get("/search-students", zValidator("query", searchStudentSchema), async (c) => {
  const { query, schoolId } = c.req.valid("query");
  const pattern = `%${query.trim().toLowerCase()}%`;
  const found = await db
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      gender: students.gender,
      gradeLevel: students.gradeLevel,
      academicYear: students.academicYear,
      status: students.status,
      schoolId: students.schoolId,
      schoolName: schools.name,
      parentName: students.parentName,
      parentPhone: students.parentPhone,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(
      and(
        eq(students.schoolId, schoolId),
        or(like(sql`lower(${students.name})`, pattern), like(sql`lower(${students.nis})`, pattern)),
        notInArray(students.status, ["new_pending", "rejected"])
      )
    )
    .limit(10);
  return c.json({ success: true, data: found });
});

// Katalog seragam per tahun ajaran (katalog kecil, tanpa partisi sekolah).
publicUniformOrdersRouter.get("/catalog", zValidator("query", catalogQuerySchema), async (c) => {
  const { academicYear } = c.req.valid("query");
  const [variants, packages] = await Promise.all([listUniformVariants(db), listUniformPackages(db)]);
  return c.json({
    success: true,
    data: {
      variants: variants
        .filter((v) => v.variant.academicYear === academicYear)
        .map((v) => ({ ...v.variant, sizes: v.sizes, stock: v.stock })),
      packages: packages
        .filter((p) => p.package.academicYear === academicYear)
        .map((p) => ({ ...p.package, bom: p.bom, readyQty: p.readyQty })),
    },
  });
});

publicUniformOrdersRouter.post("/orders", zValidator("json", submitUniformOrderSchema), async (c) => {
  const result = await submitUniformOrder(db, c.req.valid("json"));
  if (!result.ok) return c.json({ success: false, message: result.message }, result.status);
  return c.json({ success: true, data: result.data }, 201);
});

// Lacak kiriman: nomor order atau murid + (opsional) sekolah.
publicUniformOrdersRouter.get("/lookup-order", zValidator("query", lookupQuerySchema), async (c) => {
  const { orderNumber, studentId, schoolId } = c.req.valid("query");
  const conditions = [];
  if (studentId) {
    conditions.push(eq(uniformOrders.studentId, studentId));
  } else {
    conditions.push(like(sql`lower(${uniformOrders.orderNumber})`, `%${(orderNumber as string).trim().toLowerCase()}%`));
  }
  if (schoolId) conditions.push(eq(uniformOrders.schoolId, schoolId));
  const matched: Array<{ id: string }> = await db
    .select({
      id: uniformOrders.id,
      orderNumber: uniformOrders.orderNumber,
      studentId: uniformOrders.studentId,
      studentName: students.name,
      schoolId: uniformOrders.schoolId,
      academicYear: uniformOrders.academicYear,
      shipmentStatus: uniformOrders.shipmentStatus,
      shippedAt: uniformOrders.shippedAt,
      totalAmount: uniformOrders.totalAmount,
      createdAt: uniformOrders.createdAt,
    })
    .from(uniformOrders)
    .innerJoin(students, eq(uniformOrders.studentId, students.id))
    .where(and(...conditions))
    .limit(10);
  const allItems =
    matched.length > 0
      ? await db
        .select()
        .from(uniformOrderItems)
        .where(inArray(uniformOrderItems.orderId, matched.map((m) => m.id)))
      : [];
  const itemsByOrder: Record<string, typeof allItems> = {};
  for (const item of allItems) {
    itemsByOrder[item.orderId] = [...(itemsByOrder[item.orderId] ?? []), item];
  }
  return c.json({ success: true, data: { orders: matched, items: matched.length > 0 ? (itemsByOrder[matched[0].id] ?? []) : [], itemsByOrder } });
});

const ownershipGuard = async (orderId: string, studentId: string) => {
  const [order] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  if (!order) return { ok: false as const, status: 404 as const, message: "Order seragam tidak ditemukan." };
  if (order.studentId !== studentId) return { ok: false as const, status: 403 as const, message: "Order bukan milik murid tersebut." };
  return { ok: true as const };
};

const publicExchangeSchema = z.object({
  orderId: idSchema,
  studentId: idSchema,
  oldVariantId: idSchema,
  oldSize: z.string().min(1, "Size lama wajib diisi"),
  newVariantId: idSchema,
  newSize: z.string().min(1, "Size baru wajib diisi"),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

// Pengajuan tukar ukuran mandiri oleh ortu (validasi server sama dengan staf).
publicUniformOrdersRouter.post("/exchange-requests", zValidator("json", publicExchangeSchema), async (c) => {
  const body = c.req.valid("json");
  const owned = await ownershipGuard(body.orderId, body.studentId);
  if (!owned.ok) return c.json({ success: false, message: owned.message }, owned.status);
  const result = await requestUniformExchange(db, body);
  if (!result.ok) return c.json({ success: false, message: result.message }, result.status);
  return c.json({ success: true, data: result.data }, 201);
});

const publicRefundSchema = z.object({
  orderId: idSchema,
  studentId: idSchema,
  amount: z.number().int().min(1).optional(),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

// Pengajuan refund mandiri oleh ortu.
publicUniformOrdersRouter.post("/refund-requests", zValidator("json", publicRefundSchema), async (c) => {
  const body = c.req.valid("json");
  const owned = await ownershipGuard(body.orderId, body.studentId);
  if (!owned.ok) return c.json({ success: false, message: owned.message }, owned.status);
  const result = await requestUniformRefund(db, body);
  if (!result.ok) return c.json({ success: false, message: result.message }, result.status);
  return c.json({ success: true, data: result.data }, 201);
});
