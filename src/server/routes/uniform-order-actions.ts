import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { resolveLogisticsActor, accessErrorResponse } from "../services/access-scope";
import { sendUniformInvoice } from "../services/order-invoice";
import { setUniformShipping } from "../services/order-shipping";
import {
  cashierPaymentSchema,
  recordCashierPayment,
  rejectPayment,
  rejectReasonSchema,
  verifyPayment,
} from "../services/order-payment-review";
import { fail } from "../lib/route-fail";

export const uniformOrderActionsRouter = new Hono();

// Kirim invoice WA (syarat ongkir sudah diinput).
uniformOrderActionsRouter.post("/orders/:id/send-invoice", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await sendUniformInvoice(db, c.req.param("id"), { baseUrl: new URL(c.req.url).origin });
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Invoice berhasil dikirim via WhatsApp.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Input ongkir manual gudang (syarat tombol kirim invoice).
uniformOrderActionsRouter.post("/orders/:id/shipping", zValidator("json", z.object({
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

// Kasir manual seragam (uang diterima langsung): baris auto-verified.
uniformOrderActionsRouter.post("/orders/:id/pay", zValidator("json", cashierPaymentSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await recordCashierPayment(db, "seragam", c.req.param("id"), c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Pembayaran kasir tercatat & terverifikasi.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Verifikasi klaim bukti transfer seragam (gudang).
uniformOrderActionsRouter.post("/orders/:id/payments/:paymentId/verify", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await verifyPayment(db, {
      kind: "seragam",
      orderId: c.req.param("id"),
      paymentId: c.req.param("paymentId"),
      baseUrl: new URL(c.req.url).origin,
    });
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Pembayaran terverifikasi.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Tolak klaim bukti transfer seragam (gudang) + kirim tautan unggah ulang.
uniformOrderActionsRouter.post("/orders/:id/payments/:paymentId/reject", zValidator("json", rejectReasonSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await rejectPayment(db, {
      kind: "seragam",
      orderId: c.req.param("id"),
      paymentId: c.req.param("paymentId"),
      reason: c.req.valid("json").reason,
      baseUrl: new URL(c.req.url).origin,
    });
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, message: "Bukti pembayaran ditolak.", data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
