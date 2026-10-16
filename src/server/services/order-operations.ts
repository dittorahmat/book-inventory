import type { AppDatabase } from "../../db";
import {
  AccessHttpError,
  loadScopedOrder,
  requireScopedActor,
  type AccessActor,
  type ScopedOrderRow,
} from "./access-scope";
import { assertPaketActor, assertSatuanActor } from "./order-shipping";

/**
 * Satu-satunya pemilik tarian scope order staf: resolve actor +
 * ambil order sekaligus gerbang lokasinya + tegakkan peran paket-vs-
 * satuan dalam satu seam. Route hanya memilih gate lalu memanggil
 * logika tulis; kombinatorik scope×actor tak lagi tersebar per handler.
 */
export type OrderMutationGate = "paket" | "satuan" | "none";

export type GuardedOrder =
  | { ok: true; actor: AccessActor; order: ScopedOrderRow }
  | { ok: false; status: 403 | 404; message: string };

type ScopedContext = Parameters<typeof requireScopedActor>[1];

export const guardScopedOrderMutation = async (
  database: AppDatabase,
  c: ScopedContext,
  orderId: string,
  gate: OrderMutationGate
): Promise<GuardedOrder> => {
  const { actor, locations } = await requireScopedActor(database, c);
  const scoped = await loadScopedOrder(database, actor, locations, orderId);
  if (!scoped.ok) return scoped;
  try {
    if (gate === "paket") assertPaketActor(actor);
    if (gate === "satuan") assertSatuanActor(actor);
  } catch (err) {
    if (err instanceof AccessHttpError) return { ok: false, status: err.status as 403, message: err.message };
    throw err;
  }
  return { ok: true, actor, order: scoped.order };
};
