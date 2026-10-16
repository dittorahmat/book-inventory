import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { studentBookOrders, uniformOrders } from "../../db/schema";
import { writeNow, d1WriteErrorStatus, type WriteDeps } from "../lib/d1-write";
import type { AccessActor } from "./access-scope";
import { AccessHttpError } from "./access-scope";

export type ShippingError = { ok: false; status: 400 | 403 | 404; message: string };

/** Satuan wajib lewat gudang: central + warehouse saja. */
export const assertSatuanActor = (actor: AccessActor): void => {
  if (actor.role === "central_admin" || actor.role === "warehouse_admin") return;
  throw new AccessHttpError(403, "Order satuan hanya diproses gudang pusat.");
};

/** Paket wajib lewat cabang: central + school/branch saja, gudang ditolak. */
export const assertPaketActor = (actor: AccessActor): void => {
  if (actor.role === "central_admin" || actor.role === "school_admin" || actor.role === "branch_admin") return;
  throw new AccessHttpError(403, "Paket wajib diserahkan via cabang, bukan gudang.");
};

const invalid = (message: string): ShippingError => ({ ok: false, status: 400, message });

/** Input ongkir manual gudang untuk order buku (satuan maupun paket kirim-rumah). */
export async function setBookShipping(
  database: AppDatabase,
  orderId: string,
  input: { shippingCost: number; shippingResi?: string },
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof studentBookOrders.$inferSelect } | ShippingError> {
  if (!Number.isInteger(input.shippingCost) || input.shippingCost < 0) return invalid("Ongkir wajib angka bulat >= 0.");
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Pesanan tidak ditemukan." };
  const now = writeNow(deps);
  try {
    await database
      .update(studentBookOrders)
      .set({ shippingCost: input.shippingCost, shippingResi: input.shippingResi?.trim() || null, updatedAt: now })
      .where(eq(studentBookOrders.id, orderId));
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "input ongkir buku");
    if (mapped) return { ok: false, ...mapped } as ShippingError;
    throw err;
  }
  const [updated] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  return { ok: true, data: updated };
}

/** Input ongkir manual gudang untuk order seragam. */
export async function setUniformShipping(
  database: AppDatabase,
  orderId: string,
  input: { shippingCost: number; shippingResi?: string },
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof uniformOrders.$inferSelect } | ShippingError> {
  if (!Number.isInteger(input.shippingCost) || input.shippingCost < 0) return invalid("Ongkir wajib angka bulat >= 0.");
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  const now = writeNow(deps);
  try {
    await database
      .update(uniformOrders)
      .set({ shippingCost: input.shippingCost, shippingResi: input.shippingResi?.trim() || null, updatedAt: now })
      .where(eq(uniformOrders.id, orderId));
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "input ongkir seragam");
    if (mapped) return { ok: false, ...mapped } as ShippingError;
    throw err;
  }
  const [updated] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return { ok: true, data: updated };
}
