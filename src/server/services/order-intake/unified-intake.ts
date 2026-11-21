import type { AppDatabase } from "../../../db";
import { submitPublicOrder, type SubmitPublicOrderInput, type SubmitPublicOrderResult, type SubmitPublicOrderDeps } from "./public-order";
import { submitUniformOrder, type SubmitUniformOrderDeps } from "../uniform/orders";
import type { SubmitUniformOrderPayload } from "../../../lib/uniform-types";
import type { UniformError } from "../uniform/catalog";
import type { uniformOrders } from "../../../db/schema";

export type UnifiedOrderPayload =
  | ({ type: "book" } & SubmitPublicOrderInput)
  | ({ type: "uniform" } & SubmitUniformOrderPayload);

export type UnifiedOrderResult =
  | ({ type: "book" } & SubmitPublicOrderResult)
  | ({ type: "uniform" } & ({ ok: true; data: { order: typeof uniformOrders.$inferSelect; totalAmount: number } } | UniformError));

export interface UnifiedOrderDeps {
  book?: Omit<SubmitPublicOrderDeps, "database">;
  uniform?: SubmitUniformOrderDeps;
}

/**
 * Seam terpadu pengajuan pesanan publik (Buku dan Seragam).
 * Menyembunyikan kompleksitas perakitan domain dan integrasi payment ledger di balik antarmuka murni.
 */
export async function submitOrder(
  database: AppDatabase,
  payload: UnifiedOrderPayload,
  deps?: UnifiedOrderDeps
): Promise<UnifiedOrderResult> {
  if (payload.type === "book") {
    const { type: _type, ...bookInput } = payload;
    void _type;
    const res = await submitPublicOrder(bookInput, { database, ...deps?.book });
    return { type: "book", ...res };
  }

  const { type: _type, ...uniformInput } = payload;
  void _type;
  const res = await submitUniformOrder(database, uniformInput, deps?.uniform);
  return { type: "uniform", ...res };
}
