import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { runDemoSeed } from "../seed";
import { accessErrorResponse, requireCentralAdmin, resolveLogisticsActor, resolveRequestActor } from "../services/access-scope";
import { idSchema } from "../lib/validators";
import {
  overrideBookStock,
  overridePackageStock,
  AllocationViolationError,
} from "../services/stock/book-stock-override";
import { DemoStockOverrideDisabledError } from "../services/demo-stock-override";

export const demoRouter = new Hono();

const bookStockOverrideSchema = z.object({
  schoolId: idSchema,
  bookId: idSchema,
  targetQuantity: z.number().int().min(0, "Jumlah stok minimal 0"),
});

const packageStockOverrideSchema = z.object({
  schoolId: idSchema,
  packageId: idSchema,
  targetQuantity: z.number().int().min(0, "Jumlah stok minimal 0"),
});

demoRouter.post("/seed", async (c) => {
  try {
    requireCentralAdmin(await resolveRequestActor(c));
    const result = await runDemoSeed();
    return c.json({
      success: true,
      message: "Data demo operasional Al Wildan berhasil dirombak total dan diperbarui secara komprehensif!",
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST /api/demo/stock/book-override (khusus admin logistik / central saat demo mode aktif)
demoRouter.post("/stock/book-override", zValidator("json", bookStockOverrideSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
    const result = await overrideBookStock(db, body);
    return c.json({
      success: true,
      message: `Stok buku berhasil diatur menjadi ${result.newQuantity}.`,
      data: result,
    });
  } catch (err) {
    if (err instanceof DemoStockOverrideDisabledError) {
      return c.json({ success: false, message: err.message }, 403);
    }
    if (err instanceof AllocationViolationError) {
      return c.json({ success: false, message: err.message }, 400);
    }
    return accessErrorResponse(c, err);
  }
});

// POST /api/demo/stock/package-override (khusus admin logistik / central saat demo mode aktif)
demoRouter.post("/stock/package-override", zValidator("json", packageStockOverrideSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
    const result = await overridePackageStock(db, body);
    return c.json({
      success: true,
      message: `Stok paket berhasil diatur menjadi ${result.newQuantity}.`,
      data: result,
    });
  } catch (err) {
    if (err instanceof DemoStockOverrideDisabledError) {
      return c.json({ success: false, message: err.message }, 403);
    }
    if (err instanceof AllocationViolationError) {
      return c.json({ success: false, message: err.message }, 400);
    }
    return accessErrorResponse(c, err);
  }
});

