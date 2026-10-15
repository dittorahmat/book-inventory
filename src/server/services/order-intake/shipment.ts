import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { studentBookOrders, studentOrderItems } from "../../../db/schema";
import { writeNow, type WriteDeps } from "../../lib/d1-write";

export interface SatuanShipmentError {
  ok: false;
  status: 400 | 404;
  message: string;
}

/** Tandai kiriman satuan: belum_dikirim → sudah_dikirim (+ shippedAt). Satu arah. */
export async function markSatuanShipped(
  database: AppDatabase,
  orderId: string,
  deps?: WriteDeps,
): Promise<{ ok: true; data: typeof studentBookOrders.$inferSelect } | SatuanShipmentError> {
  const now = writeNow(deps);
  const [order] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Order tidak ditemukan." };
  if (order.satuanShipmentStatus === "sudah_dikirim")
    return { ok: false, status: 400, message: "Satuan order sudah ditandai terkirim." };
  const lines = await database
    .select({ id: studentOrderItems.id })
    .from(studentOrderItems)
    .where(eq(studentOrderItems.orderId, orderId))
    .limit(1);
  if (lines.length === 0)
    return { ok: false, status: 400, message: "Order paket ambil-sendiri tidak memakai flag kirim satuan." };
  if (!order.homeAddressSnapshot?.trim())
    return { ok: false, status: 400, message: "Alamat rumah satuan belum diisi." };
  await database
    .update(studentBookOrders)
    .set({ satuanShipmentStatus: "sudah_dikirim", satuanShippedAt: now, updatedAt: now })
    .where(eq(studentBookOrders.id, orderId));
  const [updated] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, orderId));
  return { ok: true, data: updated };
}
