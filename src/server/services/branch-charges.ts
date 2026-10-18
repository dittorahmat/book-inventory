import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { branchCharges } from "../../db/schema";
import { writeNow, type WriteDeps } from "../lib/d1-write";
import { documentNumber, epochTimeFragment, randomSerial } from "../lib/document-number";

/**
 * Tagihan Cabang: kewajiban cabang ke gudang per order. Terbit `open` di dua
 * titik pemicu — order dibuat (seragam & buku satuan, dikirim dari gudang)
 * atau serah-terima (paket buku yang sudah dipegang cabang, konsinyasi) —
 * lalu menjadi `final` saat gudang menginput ongkir. Hanya `final` masuk klaim.
 */

export type ChargeSourceType = "book_order" | "uniform_order";
export type ChargeTrigger = "handover" | "order_created";
export type ChargeStatus = "open" | "final";

export interface EmitChargeInput {
  schoolId: string;
  sourceType: ChargeSourceType;
  sourceId: string;
  triggerEvent: ChargeTrigger;
  goodsAmount: number;
}

/**
 * Query lazy: tagihan terbit dalam batch tulis yang sama dengan order atau
 * serah-terima. `onConflictDoNothing` pada unique (sumber, id) membuat
 * pemanggilan berulang aman — satu order tetap satu tagihan.
 */
export const emitChargeQuery = (database: AppDatabase, input: EmitChargeInput, deps?: WriteDeps) => {
  const now = writeNow(deps);
  return database
    .insert(branchCharges)
    .values({
      id: deps?.generateId ? deps.generateId() : crypto.randomUUID(),
      chargeNumber: documentNumber("TGH", epochTimeFragment(Date.now(), 8), randomSerial(6)),
      schoolId: input.schoolId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      triggerEvent: input.triggerEvent,
      chargeableAt: now,
      goodsAmount: input.goodsAmount,
      shippingAmount: 0,
      status: "open",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
};

/** Query lazy: ongkir masuk → tagihan final dan siap masuk klaim. */
export const finalizeChargeQuery = (
  database: AppDatabase,
  sourceType: ChargeSourceType,
  sourceId: string,
  shippingAmount: number,
  deps?: WriteDeps
) => {
  const now = writeNow(deps);
  return database
    .update(branchCharges)
    .set({ shippingAmount, status: "final", finalizedAt: now, updatedAt: now })
    .where(and(eq(branchCharges.sourceType, sourceType), eq(branchCharges.sourceId, sourceId)));
};

export interface ChargeFilter {
  schoolId?: string;
  status?: ChargeStatus;
  limit?: number;
}

/** Daftar tagihan (layar rekonsiliasi + daftar kerja "menunggu ongkir"). */
export const listCharges = async (database: AppDatabase, filter: ChargeFilter) => {
  const conditions = [
    filter.schoolId ? eq(branchCharges.schoolId, filter.schoolId) : undefined,
    filter.status ? eq(branchCharges.status, filter.status) : undefined,
  ];
  return database
    .select()
    .from(branchCharges)
    .where(and(...conditions))
    .orderBy(desc(branchCharges.chargeableAt))
    .limit(Math.min(filter.limit ?? 100, 200));
};
