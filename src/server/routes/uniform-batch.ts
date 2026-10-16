import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { desc, and, eq } from "drizzle-orm";
import { db } from "../../db";
import { students, uniformOrders, uniformRejects, uniformVariants } from "../../db/schema";
import { idSchema } from "../lib/validators";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedActor,
  resolveLogisticsActor,
} from "../services/access-scope";
import { adjustManualStock } from "../services/uniform/supply";
import {
  buildEkspedisiCsv,
  buildPackingCsv,
  fetchUniformExportRows,
  getUniformSalesReport,
  uniformSalesToCsv,
} from "../services/uniform/report";
import { resolveUniformScholarship } from "../services/uniform";

export const uniformBatchRouter = new Hono();

const fail = (c: { json: (body: unknown, status?: 400 | 403 | 404) => Response }, result: { status: 400 | 403 | 404; message: string }) =>
  c.json({ success: false, message: result.message }, result.status);

// Verifikasi pengajuan beasiswa seragam (logistik).
uniformBatchRouter.post("/orders/:id/scholarship", zValidator("json", z.object({
  action: z.enum(["approve", "reject"]),
})), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await resolveUniformScholarship(db, c.req.param("id"), c.req.valid("json").action);
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Beasiswa seragam diproses.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Stok awal / stok masuk manual gudang (tanpa PO).
const adjustSchema = z.object({
  variantId: idSchema,
  size: z.string().optional(),
  quantity: z.number().int().min(0, "Kuantitas wajib >= 0"),
  mode: z.enum(["add", "set"]),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

uniformBatchRouter.post("/stock/adjust", zValidator("json", adjustSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await adjustManualStock(db, c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Stok berhasil disesuaikan.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Catatan barang reject seragam (gudang).
uniformBatchRouter.get("/rejects", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const rows = await db.select().from(uniformRejects).orderBy(desc(uniformRejects.createdAt)).limit(100);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

const rejectSchema = z.object({
  variantId: idSchema,
  size: z.string().optional(),
  quantity: z.number().int().min(1, "Qty minimal 1"),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

uniformBatchRouter.post("/rejects", zValidator("json", rejectSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
    const [variant] = await db.select({ id: uniformVariants.id }).from(uniformVariants).where(eq(uniformVariants.id, body.variantId));
    if (!variant) return c.json({ success: false, message: "Varian tidak dikenal." }, 404);
    const now = new Date().toISOString();
    const [created] = await db.insert(uniformRejects).values({
      id: crypto.randomUUID(),
      variantId: body.variantId,
      size: body.size?.trim() || "—",
      quantity: body.quantity,
      reason: body.reason.trim(),
      createdAt: now,
    }).returning();
    return c.json({ success: true, message: "Catatan reject tersimpan.", data: created }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// CSV rekap penjualan seragam (sekolah × jenjang × size + filter).
uniformBatchRouter.get("/reports/sales-csv", async (c) => {
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
    return new Response(`\uFEFF${uniformSalesToCsv(report)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="laporan-seragam.csv"`,
      },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Download CSV order lunas: packing vs ekspedisi (sekolah wajib).
uniformBatchRouter.get("/orders/export", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = scope.length === 1 ? scope[0] : c.req.query("schoolId");
    if (!schoolId) return c.json({ success: false, message: "Filter sekolah wajib diisi." }, 400);
    if (scope.length === 1 && scope[0] !== schoolId) return c.json({ success: false, message: "Akses ke sekolah lain dilarang." }, 403);
    const format = c.req.query("format") === "ekspedisi" ? "ekspedisi" : "packing";
    const paidOnly = (c.req.query("paidOnly") ?? "true") !== "false";
    const rows = await fetchUniformExportRows(db, schoolId, paidOnly);
    const csv = format === "ekspedisi" ? buildEkspedisiCsv(rows) : buildPackingCsv(rows);
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="seragam-${format}-${schoolId}.csv"`,
      },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Upload hasil ekspedisi (nama, NIS, resi, ongkir): cocokkan NIS → order terbaru.
const importRowSchema = z.object({
  nis: z.string().min(1, "NIS wajib diisi"),
  resi: z.string().optional().default(""),
  ongkir: z.number().int().min(0, "Ongkir wajib >= 0").default(0),
});

const importSchema = z.object({
  schoolId: idSchema,
  markShipped: z.boolean().default(false),
  rows: z.array(importRowSchema).min(1).max(500),
});

uniformBatchRouter.post("/orders/import-shipping", zValidator("json", importSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const { schoolId, markShipped, rows } = c.req.valid("json");
    try {
      assertLocationAllowed(actor, schoolId, locations);
    } catch (err) {
      return accessErrorResponse(c, err);
    }
    if (actor.role !== "central_admin" && actor.role !== "warehouse_admin") {
      return c.json({ success: false, message: "Import ekspedisi hanya untuk gudang/pusat." }, 403);
    }
    const updated: string[] = [];
    const rejected: Array<{ nis: string; reason: string }> = [];
    for (const row of rows) {
      const nis = row.nis.trim();
      const [student] = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.nis, nis)))
        .limit(1);
      if (!student) {
        rejected.push({ nis, reason: "NIS tidak ditemukan (baris ditolak)." });
        continue;
      }
      const [order] = await db
        .select()
        .from(uniformOrders)
        .where(eq(uniformOrders.studentId, student.id))
        .orderBy(desc(uniformOrders.createdAt))
        .limit(1);
      if (!order || order.schoolId !== schoolId) {
        rejected.push({ nis, reason: "Tidak ada order seragam murid ini di sekolah tersebut." });
        continue;
      }
      const now = new Date().toISOString();
      await db
        .update(uniformOrders)
        .set({
          shippingCost: row.ongkir,
          shippingResi: row.resi.trim() || order.shippingResi,
          shipmentStatus: markShipped ? "sudah_dikirim" : order.shipmentStatus,
          shippedAt: markShipped ? (order.shippedAt ?? now) : order.shippedAt,
          updatedAt: now,
        })
        .where(eq(uniformOrders.id, order.id));
      updated.push(nis);
    }
    return c.json({ success: true, message: `${updated.length} baris diperbarui, ${rejected.length} ditolak.`, data: { updated, rejected } });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
