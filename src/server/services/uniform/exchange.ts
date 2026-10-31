import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  uniformExchanges,
  uniformOrderItems,
  uniformOrders,
  uniformPackageBom,
  uniformSizes,
  uniformStock,
  uniformVariants,
} from "../../../db/schema";
import { d1WriteErrorStatus, newWriteId, runWriteBatch, writeNow, type WriteDeps } from "../../lib/d1-write";
import type { UniformError } from "./catalog";
import { adjustVariantStockQuery } from "./stock";

/**
 * Satu-satunya mesin siklus hidup Tukar Ukuran / Penukaran Seragam (ADR-0019):
 * requested → approved → completed | rejected. Dulu dua modul menjalankan
 * transisi yang sama dengan dua kosakata aksi dan saling menimpa status.
 * Resi retur, resi pengganti, dan ETA backorder kini kolom baris exchange,
 * bukan JSON di system_settings (AGENTS §0.10).
 */

/** Batas tukar ukuran (hari sejak order dibuat). */
export const EXCHANGE_WINDOW_DAYS = 14;

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

type OrderRow = typeof uniformOrders.$inferSelect;
type ExchangeRow = typeof uniformExchanges.$inferSelect;

async function loadOrder(database: AppDatabase, orderId: string): Promise<OrderRow | null> {
  const [order]: OrderRow[] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return order ?? null;
}

async function orderHasVariant(
  database: AppDatabase,
  orderId: string,
  variantId: string,
  size: string
): Promise<boolean> {
  const items: Array<typeof uniformOrderItems.$inferSelect> = await database
    .select()
    .from(uniformOrderItems)
    .where(eq(uniformOrderItems.orderId, orderId));
  if (items.some((i) => i.variantId === variantId && i.size === size)) return true;
  const packageIds = [...new Set(items.filter((i) => i.packageId).map((i) => i.packageId as string))];
  if (packageIds.length === 0) return false;
  const bom: Array<{ variantId: string }> = await database
    .select({ variantId: uniformPackageBom.variantId })
    .from(uniformPackageBom)
    .where(inArray(uniformPackageBom.packageId, packageIds));
  return bom.some((b) => b.variantId === variantId);
}

export interface ExchangeRequestInput {
  orderId: string;
  oldVariantId: string;
  oldSize: string;
  newVariantId: string;
  newSize: string;
  reason: string;
  /** Resi retur dari orang tua (opsional saat pengajuan). */
  courierResi?: string;
}

export async function requestUniformExchange(
  database: AppDatabase,
  input: ExchangeRequestInput,
  deps?: WriteDeps
): Promise<{ ok: true; data: ExchangeRow } | UniformError> {
  const now = writeNow(deps);
  if (!input.reason.trim()) return invalid("Alasan tukar wajib diisi.");
  const order = await loadOrder(database, input.orderId);
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  const ageDays = (Date.parse(now) - Date.parse(order.createdAt)) / 86400000;
  if (ageDays > EXCHANGE_WINDOW_DAYS) return invalid(`Tukar ukuran maksimal ${EXCHANGE_WINDOW_DAYS} hari sejak order.`);

  const variants: Array<typeof uniformVariants.$inferSelect> = await database
    .select()
    .from(uniformVariants)
    .where(inArray(uniformVariants.id, [input.oldVariantId, input.newVariantId]));
  const oldV = variants.find((v) => v.id === input.oldVariantId);
  const newV = variants.find((v) => v.id === input.newVariantId);
  if (!oldV || !newV) return invalid("Varian lama/baru tidak dikenal.");
  if (oldV.kind === "kain_harian" || newV.kind === "kain_harian") {
    return invalid("Kain yang sudah dipotong tidak bisa tukar ukuran — ajukan refund bila cacat.");
  }
  const allowed = await database
    .select()
    .from(uniformSizes)
    .where(and(eq(uniformSizes.variantId, input.newVariantId), eq(uniformSizes.size, input.newSize)));
  if (allowed.length === 0) return invalid(`Size ${input.newSize} tidak terdaftar untuk varian tersebut.`);
  if (!(await orderHasVariant(database, input.orderId, input.oldVariantId, input.oldSize))) {
    return invalid("Item yang ditukar tidak ada di order tersebut.");
  }

  const id = newWriteId(deps);
  try {
    await database.insert(uniformExchanges).values({
      id,
      orderId: input.orderId,
      studentId: order.studentId,
      oldVariantId: input.oldVariantId,
      oldSize: input.oldSize,
      newVariantId: input.newVariantId,
      newSize: input.newSize,
      reason: input.reason.trim(),
      courierResi: input.courierResi?.trim() || null,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "mencatat tukar ukuran");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const [created]: ExchangeRow[] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, id));
  return { ok: true, data: created };
}

export interface ResolveExchangeInput {
  exchangeId: string;
  /** approve = setujui tanpa detail kirim; ready/backorder = jalur olahraga. */
  decision: "approve" | "ready" | "backorder" | "complete" | "reject";
  replacementResi?: string;
  estimatedShipDate?: string;
  handledByUserId?: string;
}

export async function resolveUniformExchange(
  database: AppDatabase,
  input: ResolveExchangeInput,
  deps?: WriteDeps
): Promise<{ ok: true; data: ExchangeRow; message: string } | UniformError> {
  const now = writeNow(deps);
  const [ex]: ExchangeRow[] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, input.exchangeId));
  if (!ex) return { ok: false, status: 404, message: "Pengajuan tukar tidak ditemukan." };

  const markApproved = async (detail: { replacementResi?: string; estimatedShipDate?: string }) => {
    await database
      .update(uniformExchanges)
      .set({
        status: "approved",
        replacementResi: detail.replacementResi?.trim() || ex.replacementResi,
        estimatedShipDate: detail.estimatedShipDate?.trim() || ex.estimatedShipDate,
        handledByUserId: input.handledByUserId ?? null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(uniformExchanges.id, ex.id));
    const [updated] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, ex.id));
    return updated;
  };

  if (input.decision === "reject") {
    if (ex.status !== "requested") return invalid("Hanya pengajuan baru yang bisa ditolak.");
    await database
      .update(uniformExchanges)
      .set({ status: "rejected", handledByUserId: input.handledByUserId ?? null, resolvedAt: now, updatedAt: now })
      .where(eq(uniformExchanges.id, ex.id));
    const [updated] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, ex.id));
    return { ok: true, data: updated, message: "Pengajuan tukar ukuran ditolak" };
  }

  if (input.decision === "complete") {
    if (ex.status !== "approved") return invalid("Hanya pengajuan yang disetujui yang bisa diselesaikan.");
    const [fresh] = await database
      .select()
      .from(uniformStock)
      .where(and(eq(uniformStock.variantId, ex.newVariantId), eq(uniformStock.size, ex.newSize)));
    if (!fresh || fresh.quantity < 1) return invalid("Stok size pengganti habis di gudang.");

    try {
      // Tulis sekuensial (§10): stok pengganti keluar, stok lama kembali.
      await runWriteBatch(database, [
        adjustVariantStockQuery(database, { variantId: ex.newVariantId, size: ex.newSize, delta: -1 }, "require", { now }),
        adjustVariantStockQuery(database, { variantId: ex.oldVariantId, size: ex.oldSize, delta: 1 }, "create", { now }),
      ]);
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "penukaran seragam");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }

    await database
      .update(uniformExchanges)
      .set({
        status: "completed",
        replacementResi: input.replacementResi?.trim() || ex.replacementResi,
        handledByUserId: input.handledByUserId ?? null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(uniformExchanges.id, ex.id));
    const [updated] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, ex.id));
    return { ok: true, data: updated, message: "Penukaran selesai, mutasi stok fisik gudang berhasil dicatat" };
  }

  // approve | ready | backorder
  if (ex.status !== "requested") return invalid("Hanya pengajuan baru yang bisa disetujui.");

  if (input.decision === "ready") {
    if (!input.replacementResi?.trim()) return invalid("Nomor resi kirim baru wajib diisi untuk stok ready.");
    const stockInfo = await checkReplacementStock(database, ex.newVariantId, ex.newSize);
    if (!stockInfo.available) return invalid("Stok pengganti sedang kosong, gunakan opsi Backorder (ETA).");
    const updated = await markApproved({ replacementResi: input.replacementResi });
    return { ok: true, data: updated, message: "Pengajuan disetujui (Ready Stock) dengan resi baru" };
  }

  if (input.decision === "backorder") {
    if (!input.estimatedShipDate?.trim()) return invalid("Estimasi tanggal kirim (ETA) wajib diisi untuk backorder.");
    const updated = await markApproved({ estimatedShipDate: input.estimatedShipDate });
    return { ok: true, data: updated, message: "Pengajuan disetujui (Backorder) dengan estimasi tanggal kirim" };
  }

  const stockInfo = await checkReplacementStock(database, ex.newVariantId, ex.newSize);
  if (!stockInfo.available) return invalid("Stok size pengganti tidak tersedia.");
  const updated = await markApproved({});
  return { ok: true, data: updated, message: "Pengajuan tukar disetujui." };
}

export async function checkReplacementStock(
  database: AppDatabase,
  newVariantId: string,
  newSize: string
): Promise<{ available: boolean; quantity: number }> {
  const [stock] = await database
    .select()
    .from(uniformStock)
    .where(and(eq(uniformStock.variantId, newVariantId), eq(uniformStock.size, newSize)));
  const quantity = stock?.quantity ?? 0;
  return { available: quantity > 0, quantity };
}

export async function listUniformExchanges(
  database: AppDatabase,
  schoolId?: string,
  status?: string
): Promise<ExchangeRow[]> {
  // Seluruh filter di WHERE SQL + LIMIT (§11): join order untuk partisi sekolah.
  const conditions = [
    schoolId ? eq(uniformOrders.schoolId, schoolId) : undefined,
    status ? eq(uniformExchanges.status, status as ExchangeRow["status"]) : undefined,
  ].filter((c) => c !== undefined);
  if (conditions.length === 0) {
    return database.select().from(uniformExchanges).limit(50);
  }
  const rows = await database
    .select({ ex: uniformExchanges })
    .from(uniformExchanges)
    .innerJoin(uniformOrders, eq(uniformExchanges.orderId, uniformOrders.id))
    .where(and(...conditions))
    .limit(50);
  return rows.map((r: { ex: ExchangeRow }) => r.ex);
}

/** Pelacakan publik: satu baris exchange, tanpa round-trip JSON. */
export const findUniformExchange = async (
  database: AppDatabase,
  exchangeId: string
): Promise<ExchangeRow | null> => {
  const [row] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, exchangeId));
  return row ?? null;
};
