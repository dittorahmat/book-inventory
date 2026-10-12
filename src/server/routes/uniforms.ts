import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { desc } from "drizzle-orm";
import { db } from "../../db";
import { uniformPos } from "../../db/schema";
import { idSchema, academicYearSchema } from "../lib/validators";
import {
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
