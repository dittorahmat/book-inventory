import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import {
  accessErrorResponse,
  resolveLogisticsActor,
} from "../services/access-scope";
import { sellDirect } from "../services/direct-sale";

export const directSalesRouter = new Hono();

const directSaleSchema = z.object({
  schoolId: z.string().min(1, "Lokasi gudang wajib dipilih"),
  buyerName: z.string().min(1, "Nama pembeli / orang tua wajib diisi"),
  buyerPhone: z.string().min(6, "Nomor telepon / WA wajib diisi"),
  studentNis: z.string().optional(),
  paymentMethod: z.enum(["cash", "transfer"]).default("cash"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      bookId: z.string().min(1, "Buku wajib dipilih"),
      quantity: z.number().int().min(1, "Kuantitas minimal 1"),
    })
  ).min(1, "Minimal 1 buku dipilih"),
});

// POST direct sale to parent from Central Warehouse
directSalesRouter.post("/", zValidator("json", directSaleSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");

    const result = await sellDirect(db, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json(
      {
        success: true,
        message: `Penjualan langsung ${result.data.orderNumber} berhasil diproses. Stok fisik telah dikurangkan.`,
        data: {
          id: result.data.id,
          orderNumber: result.data.orderNumber,
          totalAmount: result.data.totalAmount,
          buyerName: result.data.buyerName,
        },
      },
      201
    );
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
