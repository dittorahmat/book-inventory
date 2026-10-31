import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { students, uniformOrders, uniformOrderItems } from "../../db/schema";
import { matchLower } from "../lib/partitioned-search";
import { idSchema, academicYearSchema } from "../lib/validators";
import {
  findUniformExchange,
  listUniformPackages,
  listUniformVariants,
  requestUniformExchange,
  requestUniformRefund,
  submitUniformOrder,
  isUniformSatuanEnabled,
} from "../services/uniform";
import { requestUniformWithdrawal } from "../services/uniform-withdrawal";
import { confirmUniformPayment, lookupUniformByToken } from "../services/order-invoice";
import { searchVerifiedStudents, toConfirmOrderView, toUniformSearchView } from "../services/public-order";

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
    orderType: z.enum(["regular", "scholarship"]).default("regular"),
    scholarshipProofBase64: z.string().optional(),
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
  const found = await searchVerifiedStudents(db, query, schoolId);
  return c.json({ success: true, data: found.map(toUniformSearchView) });
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

// Status on/off pembelian satuan seragam (cermin satuan buku).
publicUniformOrdersRouter.get("/satuan-status", async (c) => {
  return c.json({ success: true, data: { open: await isUniformSatuanEnabled(db) } });
});

publicUniformOrdersRouter.post("/orders", zValidator("json", submitUniformOrderSchema), async (c) => {
  const result = await submitUniformOrder(db, c.req.valid("json"));
  if (!result.ok) return c.json({ success: false, message: result.message }, result.status);
  return c.json({ success: true, data: result.data }, 201);
});

// Konfirmasi pembayaran via link invoice (lunas/bertahap, termin bebas).
publicUniformOrdersRouter.get("/confirm/:token", async (c) => {
  const found = await lookupUniformByToken(db, c.req.param("token"));
  if (!found) return c.json({ success: false, message: "Link konfirmasi tidak valid." }, 404);
  return c.json({ success: true, data: toConfirmOrderView(found) });
});

const uniformConfirmSchema = z.object({
  transferAmount: z.number().int().min(1, "Nominal transfer minimal Rp 1"),
  allocationAmount: z.number().int().min(1, "Nominal alokasi minimal Rp 1"),
  bankName: z.string().optional(),
  referenceNumber: z.string().optional(),
  paymentProofBase64: z.string().optional(),
});

publicUniformOrdersRouter.post("/confirm/:token", zValidator("json", uniformConfirmSchema), async (c) => {
  const result = await confirmUniformPayment(db, c.req.param("token"), c.req.valid("json"));
  if (!result.ok) return c.json({ success: false, message: result.message }, result.status);
  return c.json({ success: true, message: "Konfirmasi pembayaran tercatat.", data: result.data }, 201);
});

// Lacak kiriman: nomor order atau murid + (opsional) sekolah.
publicUniformOrdersRouter.get("/lookup-order", zValidator("query", lookupQuerySchema), async (c) => {
  const { orderNumber, studentId, schoolId } = c.req.valid("query");
  const conditions = [];
  if (studentId) {
    conditions.push(eq(uniformOrders.studentId, studentId));
  } else {
    conditions.push(matchLower(uniformOrders.orderNumber, orderNumber as string));
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
  courierResi: z.string().optional(),
});

// Pengajuan tukar ukuran mandiri oleh ortu (validasi server sama dengan staf).
publicUniformOrdersRouter.post("/exchange-requests", zValidator("json", publicExchangeSchema), async (c) => {
  const body = c.req.valid("json");
  const owned = await ownershipGuard(body.orderId, body.studentId);
  if (!owned.ok) return c.json({ success: false, message: owned.message }, owned.status);
  const result = await requestUniformExchange(db, {
    orderId: body.orderId,
    oldVariantId: body.oldVariantId,
    oldSize: body.oldSize,
    newVariantId: body.newVariantId,
    newSize: body.newSize,
    reason: body.reason,
    courierResi: body.courierResi,
  });
  if (!result.ok) return c.json({ success: false, message: result.message }, result.status);

  return c.json({ success: true, data: result.data }, 201);
});

// Pelacakan status & detail penukaran seragam (resi retur, resi kirim baru, estimasi tanggal kirim)
publicUniformOrdersRouter.get("/exchange-tracking/:id", async (c) => {
  const exchange = await findUniformExchange(db, c.req.param("id"));
  if (!exchange) return c.json({ success: true, data: {} });
  return c.json({
    success: true,
    data: {
      courierResi: exchange.courierResi,
      replacementResi: exchange.replacementResi,
      estimatedShipDate: exchange.estimatedShipDate,
      status: exchange.status,
      updatedAt: exchange.updatedAt,
    },
  });
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

// Pengajuan pembatalan & retur fisik seragam oleh siswa mundur (ADR-0019)
const publicWithdrawalUniformSchema = z.object({
  orderId: idSchema,
  studentId: idSchema,
  courierResi: z.string().min(3, "Nomor resi pengiriman kurir retur wajib diisi"),
  reason: z.string().min(5, "Alasan pengunduran diri minimal 5 karakter"),
  letterProofBase64: z.string().optional(),
});

publicUniformOrdersRouter.post("/cancel-withdrawal", zValidator("json", publicWithdrawalUniformSchema), async (c) => {
  const body = c.req.valid("json");
  const owned = await ownershipGuard(body.orderId, body.studentId);
  if (!owned.ok) return c.json({ success: false, message: owned.message }, owned.status);
  const result = await requestUniformWithdrawal(db, body);
  if (!result.ok) return c.json({ success: false, message: result.message }, result.status);
  return c.json({
    success: true,
    message: "Pengajuan pembatalan & retur seragam berhasil dicatat untuk review gudang.",
    data: result,
  }, 201);
});
