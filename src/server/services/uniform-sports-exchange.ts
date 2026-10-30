import { eq, and } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { systemSettings, uniformExchanges, uniformStock } from "../../db/schema";
import { adjustVariantStockQuery } from "./uniform/stock";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";

export interface SportsExchangeDetails {
  courierResi?: string;
  fulfillmentType?: "ready" | "backorder";
  replacementResi?: string;
  estimatedShipDate?: string;
  updatedAt: string;
}

export function sportsExchangeSettingsKey(exchangeId: string): string {
  return `uniform_exchange_sports_${exchangeId}`;
}

export async function saveSportsExchangeDetails(
  database: AppDatabase,
  exchangeId: string,
  details: Partial<SportsExchangeDetails>,
  deps?: WriteDeps
): Promise<SportsExchangeDetails> {
  const now = writeNow(deps);
  const key = sportsExchangeSettingsKey(exchangeId);
  const [existing] = await database.select().from(systemSettings).where(eq(systemSettings.key, key));

  let current: SportsExchangeDetails = { updatedAt: now };
  if (existing) {
    try {
      current = { ...JSON.parse(existing.value), ...details, updatedAt: now };
    } catch {
      current = { ...details, updatedAt: now };
    }
  } else {
    current = { ...details, updatedAt: now };
  }

  await database
    .insert(systemSettings)
    .values({
      key,
      value: JSON.stringify(current),
      description: "Detail pelacakan resi & backorder tukar seragam olahraga",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: JSON.stringify(current), updatedAt: now },
    });

  return current;
}

export async function getSportsExchangeDetails(
  database: AppDatabase,
  exchangeId: string
): Promise<SportsExchangeDetails | null> {
  const key = sportsExchangeSettingsKey(exchangeId);
  const [row] = await database.select().from(systemSettings).where(eq(systemSettings.key, key));
  if (!row) return null;
  try {
    return JSON.parse(row.value) as SportsExchangeDetails;
  } catch {
    return null;
  }
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

export interface ReviewSportsExchangeInput {
  exchangeId: string;
  action: "approve_ready" | "approve_backorder" | "complete" | "reject";
  replacementResi?: string;
  estimatedShipDate?: string;
  handledByUserId?: string;
}

export async function reviewSportsExchange(
  database: AppDatabase,
  input: ReviewSportsExchangeInput,
  deps?: WriteDeps
): Promise<
  | { ok: true; data: typeof uniformExchanges.$inferSelect; details: SportsExchangeDetails; message: string }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string }
> {
  const now = writeNow(deps);
  const [ex] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, input.exchangeId));
  if (!ex) return { ok: false, status: 404, message: "Pengajuan tukar seragam tidak ditemukan" };

  if (input.action === "reject") {
    if (ex.status !== "requested") return { ok: false, status: 400, message: "Hanya pengajuan baru yang bisa ditolak" };
    await database
      .update(uniformExchanges)
      .set({ status: "rejected", handledByUserId: input.handledByUserId ?? null, resolvedAt: now, updatedAt: now })
      .where(eq(uniformExchanges.id, ex.id));
    const [updated] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, ex.id));
    const details = await saveSportsExchangeDetails(database, ex.id, {}, deps);
    return { ok: true, data: updated, details, message: "Pengajuan tukar ukuran ditolak" };
  }

  if (input.action === "approve_ready") {
    if (ex.status !== "requested") return { ok: false, status: 400, message: "Hanya pengajuan baru yang bisa disetujui" };
    if (!input.replacementResi?.trim()) {
      return { ok: false, status: 400, message: "Nomor resi kirim baru wajib diisi untuk stok ready" };
    }
    const stockInfo = await checkReplacementStock(database, ex.newVariantId, ex.newSize);
    if (!stockInfo.available) {
      return { ok: false, status: 400, message: "Stok pengganti sedang kosong, gunakan opsi Backorder (ETA)" };
    }

    await database
      .update(uniformExchanges)
      .set({ status: "approved", handledByUserId: input.handledByUserId ?? null, resolvedAt: now, updatedAt: now })
      .where(eq(uniformExchanges.id, ex.id));

    const details = await saveSportsExchangeDetails(
      database,
      ex.id,
      {
        fulfillmentType: "ready",
        replacementResi: input.replacementResi.trim(),
      },
      deps
    );

    const [updated] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, ex.id));
    return { ok: true, data: updated, details, message: "Pengajuan disetujui (Ready Stock) dengan resi baru" };
  }

  if (input.action === "approve_backorder") {
    if (ex.status !== "requested") return { ok: false, status: 400, message: "Hanya pengajuan baru yang bisa disetujui" };
    if (!input.estimatedShipDate?.trim()) {
      return { ok: false, status: 400, message: "Estimasi tanggal kirim (ETA) wajib diisi untuk backorder" };
    }

    await database
      .update(uniformExchanges)
      .set({ status: "approved", handledByUserId: input.handledByUserId ?? null, resolvedAt: now, updatedAt: now })
      .where(eq(uniformExchanges.id, ex.id));

    const details = await saveSportsExchangeDetails(
      database,
      ex.id,
      {
        fulfillmentType: "backorder",
        estimatedShipDate: input.estimatedShipDate.trim(),
      },
      deps
    );

    const [updated] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, ex.id));
    return { ok: true, data: updated, details, message: "Pengajuan disetujui (Backorder) dengan estimasi tanggal kirim" };
  }

  if (input.action === "complete") {
    if (ex.status !== "approved") return { ok: false, status: 400, message: "Hanya pengajuan approved yang bisa diselesaikan" };
    const [fresh] = await database
      .select()
      .from(uniformStock)
      .where(and(eq(uniformStock.variantId, ex.newVariantId), eq(uniformStock.size, ex.newSize)));
    if (!fresh || fresh.quantity < 1) {
      return { ok: false, status: 400, message: "Stok size pengganti belum tersedia di gudang" };
    }

    try {
      await runWriteBatch(database, [
        adjustVariantStockQuery(database, { variantId: ex.newVariantId, size: ex.newSize, delta: -1 }, "require", { now }),
        adjustVariantStockQuery(database, { variantId: ex.oldVariantId, size: ex.oldSize, delta: 1 }, "create", { now }),
      ]);
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "penukaran seragam olahraga");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }

    await database
      .update(uniformExchanges)
      .set({ status: "completed", handledByUserId: input.handledByUserId ?? null, resolvedAt: now, updatedAt: now })
      .where(eq(uniformExchanges.id, ex.id));

    if (input.replacementResi?.trim()) {
      await saveSportsExchangeDetails(database, ex.id, { replacementResi: input.replacementResi.trim() }, deps);
    }

    const [updated] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, ex.id));
    const details = (await getSportsExchangeDetails(database, ex.id)) ?? { updatedAt: now };
    return { ok: true, data: updated, details, message: "Penukaran selesai, mutasi stok fisik gudang berhasil dicatat" };
  }

  return { ok: false, status: 400, message: "Aksi review tidak dikenal" };
}
