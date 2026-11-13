import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { resolveLogisticsActor, accessErrorResponse, requireScopedActor } from "../services/access-scope";
import { sendUniformInvoice } from "../services/order-invoice";
import { setUniformShipping } from "../services/order-shipping";
import { getUniformSalesReport } from "../services/uniform";
import { sendUniformShippingNotification } from "../services/uniform";
import { approveStudentWithdrawal } from "../services/order-withdrawal";
import { findRefundSlip } from "../services/refund-slip";
import {
  cashierPaymentSchema,
  recordCashierPayment,
  rejectPayment,
  rejectReasonSchema,
  verifyPayment,
} from "../services/order-payment-review";
import { fail } from "../lib/route-fail";

export const uniformOrderActionsRouter = new Hono();

// Approval seragam murid mundur & restock gudang pusat (ADR-0019)
uniformOrderActionsRouter.post("/refunds/:id/approve-withdrawal", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await approveStudentWithdrawal(db, { kind: "seragam", refundId: c.req.param("id") });
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, message: result.message, data: result.slip });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformOrderActionsRouter.get("/withdrawal-slip/:slipNumber", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const slip = await findRefundSlip(db, c.req.param("slipNumber"));
    if (!slip) return c.json({ success: false, message: "Slip bukti pengembalian seragam tidak ditemukan" }, 404);
    return c.json({ success: true, data: slip });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Laporan penjualan seragam (terpisah dari buku): sekolah × jenjang × ukuran.
uniformOrderActionsRouter.get("/reports/sales", async (c) => {
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

// Kirim info resi & panduan kurir ke WA ortu (manual / coba lagi).
uniformOrderActionsRouter.post("/orders/:id/send-shipping-notification", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const res = await sendUniformShippingNotification(db, c.req.param("id"));
    if (!res.sent) {
      return c.json({ success: false, message: res.error ?? "Gagal mengirim notifikasi resi" }, 400);
    }
    return c.json({ success: true, message: "Notifikasi resi berhasil dikirim via WhatsApp.", data: res });
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
