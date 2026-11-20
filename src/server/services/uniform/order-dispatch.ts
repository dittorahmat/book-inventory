import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { uniformOrders } from "../../../db/schema";
import { writeNow, type WriteDeps } from "../../lib/d1-write";
import { defaultStorage } from "../../../services/storage";
import { decodeBase64ToBytes } from "../../base64";
import { canDispatchUniformOrder } from "../../../lib/order-handover-guard";
import type { UniformError } from "./catalog";

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

/** Verifikasi beasiswa seragam oleh staf: approve (lunas) atau reject. */
export async function resolveUniformScholarship(
  database: AppDatabase,
  orderId: string,
  action: "approve" | "reject",
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof uniformOrders.$inferSelect } | UniformError> {
  const now = writeNow(deps);
  const [order]: Array<typeof uniformOrders.$inferSelect> = await database
    .select()
    .from(uniformOrders)
    .where(eq(uniformOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  if (order.orderType !== "scholarship" || order.paymentStatus !== "scholarship_pending") {
    return invalid("Order ini bukan pengajuan beasiswa yang menunggu verifikasi.");
  }
  const paymentStatus = action === "approve" ? "paid" : "unpaid";
  await database.update(uniformOrders).set({ paymentStatus, updatedAt: now }).where(eq(uniformOrders.id, orderId));
  const [updated] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return { ok: true, data: updated };
}

export interface MarkUniformShippedPayload {
  shippingResi?: string;
  packagePhotoBase64?: string;
}

export interface MarkUniformShippedDeps extends WriteDeps {
  storage?: typeof defaultStorage;
}

/** Tandai kiriman gudang: belum_dikirim → sudah_dikirim (+ shippedAt). Satu arah, tanpa un-ship. */
export async function markUniformShipped(
  database: AppDatabase,
  orderId: string,
  payload?: MarkUniformShippedPayload,
  deps?: MarkUniformShippedDeps
): Promise<{ ok: true; data: typeof uniformOrders.$inferSelect } | UniformError> {
  const now = writeNow(deps);
  const [order]: Array<typeof uniformOrders.$inferSelect> = await database
    .select()
    .from(uniformOrders)
    .where(eq(uniformOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  if (order.shipmentStatus === "sudah_dikirim") return invalid("Order sudah ditandai terkirim.");

  const resi = (payload?.shippingResi ?? order.shippingResi)?.trim();
  if (!resi) {
    return invalid("Nomor resi kurir wajib diisi sebelum menandai kiriman.");
  }

  // Guard kelayakan pengiriman kanonik (§0.75): paid, partial, atau scholarship_approved
  if (!canDispatchUniformOrder(order)) {
    return invalid("Order belum layak kirim: pembayaran masih belum tercatat (unpaid).");
  }

  let packagePhotoUrl = order.packagePhotoUrl;
  if (payload?.packagePhotoBase64) {
    const storage = deps?.storage ?? defaultStorage;
    packagePhotoUrl = await storage.upload(
      `uniform-packages/${order.id}_${Date.now()}.jpg`,
      decodeBase64ToBytes(payload.packagePhotoBase64),
      "image/jpeg"
    );
  }

  await database
    .update(uniformOrders)
    .set({
      shipmentStatus: "sudah_dikirim",
      shippedAt: now,
      shippingResi: resi,
      packagePhotoUrl,
      updatedAt: now,
    })
    .where(eq(uniformOrders.id, orderId));
  const [updated] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return { ok: true, data: updated };
}
