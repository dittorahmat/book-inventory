import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { studentBookOrders, studentOrderItems, uniformOrders } from "../../db/schema";
import { writeNow, d1WriteErrorStatus, type WriteDeps } from "../lib/d1-write";
import type { AccessActor } from "./access-scope";
import { AccessHttpError } from "./access-scope";

export type ShippingError = { ok: false; status: 400 | 403 | 404; message: string };

/** Satuan wajib lewat gudang: central + warehouse saja. */
export const assertSatuanActor = (actor: AccessActor): void => assertOrderActor(actor, "satuan");

/** Paket wajib lewat cabang: central + school/branch saja, gudang ditolak. */
export const assertPaketActor = (actor: AccessActor): void => assertOrderActor(actor, "paket");

/** Satu-satunya gerbang aktor order: satuan via gudang, paket via cabang. */
export const assertOrderActor = (actor: AccessActor, kind: "satuan" | "paket"): void => {
  if (kind === "satuan") {
    if (actor.role === "central_admin" || actor.role === "warehouse_admin") return;
    throw new AccessHttpError(403, "Order satuan hanya diproses gudang pusat.");
  }
  if (actor.role === "central_admin" || actor.role === "school_admin" || actor.role === "branch_admin") return;
  throw new AccessHttpError(403, "Paket wajib diserahkan via cabang, bukan gudang.");
};

const invalid = (message: string): ShippingError => ({ ok: false, status: 400, message });

/** Gerbang kirim invoice buku: order satuan wajib aktor gudang, paket-ambil bebas. */
export const assertSendInvoiceAllowed = async (
  database: AppDatabase,
  actor: AccessActor,
  orderId: string
): Promise<null | { status: 403; message: string }> => {
  const loose = await database
    .select({ id: studentOrderItems.id })
    .from(studentOrderItems)
    .where(eq(studentOrderItems.orderId, orderId))
    .limit(1);
  if (loose.length === 0) return null;
  try {
    assertSatuanActor(actor);
    return null;
  } catch (err) {
    if (err instanceof AccessHttpError) return { status: 403, message: err.message };
    throw err;
  }
};

type ShippingOrderTable = typeof studentBookOrders | typeof uniformOrders;

/**
 * Satu-satunya inti tulis ongkir manual gudang: validasi int →
 * trim resi → tulis → pemetaan error D1. Kind hanya menyumbang
 * pesan 404 + konteks error.
 */
const setShippingCore = async (
  database: AppDatabase,
  table: ShippingOrderTable,
  orderId: string,
  input: { shippingCost: number; shippingResi?: string },
  kind: { notFound: string; errorContext: string },
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof studentBookOrders.$inferSelect | typeof uniformOrders.$inferSelect } | ShippingError> => {
  if (!Number.isInteger(input.shippingCost) || input.shippingCost < 0) return invalid("Ongkir wajib angka bulat >= 0.");
  const [order] = await database.select().from(table).where(eq(table.id, orderId));
  if (!order) return { ok: false, status: 404, message: kind.notFound };
  const now = writeNow(deps);
  try {
    await database
      .update(table)
      .set({ shippingCost: input.shippingCost, shippingResi: input.shippingResi?.trim() || null, updatedAt: now })
      .where(eq(table.id, orderId));
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, kind.errorContext);
    if (mapped) return { ok: false, ...mapped } as ShippingError;
    throw err;
  }
  const [updated] = await database.select().from(table).where(eq(table.id, orderId));
  return { ok: true, data: updated };
};

/** Input ongkir manual gudang untuk order buku (satuan maupun paket kirim-rumah). */
export async function setBookShipping(
  database: AppDatabase,
  orderId: string,
  input: { shippingCost: number; shippingResi?: string },
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof studentBookOrders.$inferSelect } | ShippingError> {
  return setShippingCore(database, studentBookOrders, orderId, input, {
    notFound: "Pesanan tidak ditemukan.", errorContext: "input ongkir buku",
  }, deps) as Promise<{ ok: true; data: typeof studentBookOrders.$inferSelect } | ShippingError>;
}

/** Input ongkir manual gudang untuk order seragam. */
export async function setUniformShipping(
  database: AppDatabase,
  orderId: string,
  input: { shippingCost: number; shippingResi?: string },
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof uniformOrders.$inferSelect } | ShippingError> {
  return setShippingCore(database, uniformOrders, orderId, input, {
    notFound: "Order seragam tidak ditemukan.", errorContext: "input ongkir seragam",
  }, deps) as Promise<{ ok: true; data: typeof uniformOrders.$inferSelect } | ShippingError>;
}
