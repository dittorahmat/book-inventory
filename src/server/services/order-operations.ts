import type { AppDatabase } from "../../db";
import {
  AccessHttpError,
  loadScopedOrder,
  requireScopedActor,
  type AccessActor,
  type ScopedOrderRow,
} from "./access-scope";
import { assertPaketActor, assertSatuanActor } from "./order-shipping";
import { applyDiscretion, cancelStudentOrder, type DiscretionInput } from "./order-finance";
import { handoverPackage, type HandoverInput } from "./order-handover";
import type { WriteDeps } from "../lib/d1-write";

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
    if (actor.role === "branch_finance") {
      throw new AccessHttpError(403, "Peran finance cabang bersifat read-only dan dilarang mengubah status pesanan.");
    }
    if (gate === "paket") assertPaketActor(actor);
    if (gate === "satuan") assertSatuanActor(actor);
  } catch (err) {
    if (err instanceof AccessHttpError) return { ok: false, status: err.status as 403, message: err.message };
    throw err;
  }
  return { ok: true, actor, order: scoped.order };
};

export type OrderTransitionIntent =
  | { action: "handover"; payload: HandoverInput }
  | { action: "discretion"; payload: DiscretionInput }
  | { action: "cancel" };

export interface OrderTransitionResult {
  ok: boolean;
  status?: number;
  message?: string;
  data?: unknown;
}

/**
 * Deep Module: Eksekusi transisi siklus hidup status pesanan terpadu.
 * Memverifikasi scope otorisasi, menjalankan guard mutasi, dan menerapkan
 * perubahan status pesanan secara atomik.
 */
export async function transitionOrder(
  database: AppDatabase,
  c: ScopedContext,
  orderId: string,
  intent: OrderTransitionIntent,
  deps?: WriteDeps
): Promise<OrderTransitionResult> {
  const gate: OrderMutationGate = intent.action === "handover" ? "paket" : "none";
  const guarded = await guardScopedOrderMutation(database, c, orderId, gate);
  if (!guarded.ok) {
    return { ok: false, status: guarded.status, message: guarded.message };
  }

  switch (intent.action) {
    case "handover": {
      const res = await handoverPackage(database, orderId, intent.payload, deps);
      if (!res.ok) return { ok: false, status: res.status, message: res.message };
      return { ok: true, data: res.data };
    }

    case "discretion": {
      const res = await applyDiscretion(database, orderId, intent.payload, deps);
      if (!res.ok) return { ok: false, status: res.status, message: res.message };
      return { ok: true, data: res.data };
    }

    case "cancel": {
      const res = await cancelStudentOrder(database, orderId, deps);
      if (!res.ok) return { ok: false, status: res.status, message: res.message };
      return { ok: true, data: res.data };
    }

    default:
      return { ok: false, status: 400, message: "Aksi transisi pesanan tidak dikenal." };
  }
}

