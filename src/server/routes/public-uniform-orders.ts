import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq, like, notInArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { schools, students, uniformOrders, uniformOrderItems } from "../../db/schema";
import { idSchema, academicYearSchema } from "../lib/validators";
import { listUniformVariants, listUniformPackages } from "../services/uniform-catalog";
import { submitUniformOrder } from "../services/uniform-orders";

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

const lookupQuerySchema = z.object({
  orderNumber: z.string().min(3, "Minimal 3 karakter"),
  schoolId: idSchema.optional(),
});

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

// Lacak kiriman: nomor order + (opsional) sekolah.
publicUniformOrdersRouter.get("/lookup-order", zValidator("query", lookupQuerySchema), async (c) => {
  const { orderNumber, schoolId } = c.req.valid("query");
  const pattern = `%${orderNumber.trim().toLowerCase()}%`;
  const conditions = [like(sql`lower(${uniformOrders.orderNumber})`, pattern)];
  if (schoolId) conditions.push(eq(uniformOrders.schoolId, schoolId));
  const matched = await db
    .select({
      id: uniformOrders.id,
      orderNumber: uniformOrders.orderNumber,
      studentId: uniformOrders.studentId,
      studentName: students.name,
      schoolId: uniformOrders.schoolId,
      shipmentStatus: uniformOrders.shipmentStatus,
      shippedAt: uniformOrders.shippedAt,
      totalAmount: uniformOrders.totalAmount,
      createdAt: uniformOrders.createdAt,
    })
    .from(uniformOrders)
    .innerJoin(students, eq(uniformOrders.studentId, students.id))
    .where(and(...conditions))
    .limit(10);
  const items =
    matched.length > 0
      ? await db
        .select()
        .from(uniformOrderItems)
        .where(eq(uniformOrderItems.orderId, matched[0].id))
      : [];
  return c.json({ success: true, data: { orders: matched, items } });
});
