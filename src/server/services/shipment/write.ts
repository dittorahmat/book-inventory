import { eq, inArray, and } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import { transferShipments, transferShipmentItems, bookItems, packageItems } from "../../../db/schema";
import { chunkRows, D1_INLIST_CHUNK_SIZE, d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { documentNumber, epochTimeFragment } from "../../lib/document-number";
import { planCreateLines, type ShipmentLineInput } from "./plan";

export interface CreateShipmentInput {
  fromSchoolId: string;
  toSchoolId: string;
  /** Input kuantitas per judul/paket; fisiknya dialokasikan otomatis FIFO. */
  items?: ShipmentLineInput[];
  bookItemIds?: string[];
  packageItemIds?: string[];
  notes?: string;
  reason?: string;
  instant?: boolean;
}

export interface LooseReceipt {
  bookItemId: string;
  condition: "good" | "damaged" | "missing";
  notes?: string;
}

export interface BundleReceipt {
  packageItemId: string;
  condition: "good" | "damaged" | "missing";
  notes?: string;
}

export type ServiceError = { ok: false; status: ContentfulStatusCode; message: string };

export async function createShipment(
  database: AppDatabase,
  input: CreateShipmentInput
): Promise<{ ok: true; shipment: any } | ServiceError> {
  const now = new Date().toISOString();
  const shipmentId = crypto.randomUUID();
  const shipmentNumber = documentNumber("TRF", epochTimeFragment(Date.now(), 6));

  // Pick FIFO + validasi shippable + snapshot harga: satu rencana dari
  // modul shipment-plan (predikat validasi = predikat pick, tak bisa drift).
  const planned = await planCreateLines(database, input.fromSchoolId, {
    items: input.items,
    bookItemIds: input.bookItemIds,
    packageItemIds: input.packageItemIds,
  });
  if (!planned.ok) return planned;
  const { looseIds, bundleIds, looseSnapshots, bundleSnapshots, total } = planned.plan;

  // Tulis induk + anak atomik via seam lib/d1-write (batch di D1, sekuensial
  // di bun-sqlite). Total datang dari rencana agar cukup satu INSERT shipment —
  // tanpa update susulan + .returning() yang rapuh di D1.
  const looseLines = looseIds.map((bookItemId) => ({ bookItemId, snapshot: looseSnapshots.get(bookItemId) || 0 }));
  const bundleLines = bundleIds.flatMap((packageItemId) => {
    const meta = bundleSnapshots.get(packageItemId);
    return meta ? [{ packageItemId, meta }] : [];
  });

  try {
    const initialStatus = input.instant ? "completed" : "draft";
    const relocateLooseWrites = input.instant && looseLines.length > 0
      ? [
          database
            .update(bookItems)
            .set({ currentSchoolId: input.toSchoolId, status: "in_stock", updatedAt: now })
            .where(inArray(bookItems.id, looseLines.map((l) => l.bookItemId))),
        ]
      : [];
    const relocateBundleWrites = input.instant && bundleLines.length > 0
      ? [
          database
            .update(packageItems)
            .set({ currentSchoolId: input.toSchoolId, status: "in_stock", updatedAt: now })
            .where(inArray(packageItems.id, bundleLines.map((l) => l.packageItemId))),
        ]
      : [];

    const looseRows: (typeof transferShipmentItems.$inferInsert)[] = looseLines.map((l) => ({
      id: crypto.randomUUID(),
      shipmentId,
      itemType: "loose",
      bookItemId: l.bookItemId,
      packageId: null,
      packageItemId: null,
      quantity: 1,
      unitPriceSnapshot: l.snapshot,
      receivedCondition: input.instant ? "good" : null,
      createdAt: now,
    }));
    const bundleRows: (typeof transferShipmentItems.$inferInsert)[] = bundleLines.map((l) => ({
      id: crypto.randomUUID(),
      shipmentId,
      itemType: "package",
      bookItemId: null,
      packageId: l.meta.packageId,
      packageItemId: l.packageItemId,
      quantity: 1,
      unitPriceSnapshot: l.meta.snapshot,
      receivedCondition: input.instant ? "good" : null,
      createdAt: now,
    }));

    await runWriteBatch(database, [
      database.insert(transferShipments).values({
        id: shipmentId,
        shipmentNumber,
        fromSchoolId: input.fromSchoolId,
        toSchoolId: input.toSchoolId,
        status: initialStatus,
        totalDeclaredValue: total,
        dispatchedAt: input.instant ? now : null,
        receivedAt: input.instant ? now : null,
        notes: input.notes,
        reason: input.reason,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(looseRows).map((rows) => database.insert(transferShipmentItems).values(rows)),
      ...chunkRows(bundleRows).map((rows) => database.insert(transferShipmentItems).values(rows)),
      ...relocateLooseWrites,
      ...relocateBundleWrites,
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pembuatan transfer");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const [created] = await database
    .select()
    .from(transferShipments)
    .where(eq(transferShipments.id, shipmentId));

  return { ok: true, shipment: created };
}

export async function dispatchShipment(
  database: AppDatabase,
  id: string
): Promise<{ ok: true; shipment: any } | ServiceError> {
  const [shipment] = await database.select().from(transferShipments).where(eq(transferShipments.id, id));

  if (!shipment) {
    return { ok: false, status: 404, message: "Shipment not found" };
  }
  if (shipment.status !== "draft" && shipment.status !== "pending_dispatch") {
    return { ok: false, status: 400, message: "Shipment cannot be dispatched from current state" };
  }

  const now = new Date().toISOString();
  const items = await database
    .select()
    .from(transferShipmentItems)
    .where(eq(transferShipmentItems.shipmentId, id));

  const looseIds = items.filter((i: any) => i.itemType !== "package" && i.bookItemId).map((i: any) => i.bookItemId as string);
  const bundleIds = items.filter((i: any) => i.itemType === "package" && i.packageItemId).map((i: any) => i.packageItemId as string);

  // Satu batch atomik via seam lib/d1-write (batch di D1, sekuensial di
  // bun-sqlite); IN-list di-chunk agar D1-safe pada volume produksi.
  try {
    await runWriteBatch(database, [
      ...chunkRows<string>(looseIds, D1_INLIST_CHUNK_SIZE).map((ids) =>
        database.update(bookItems).set({ status: "in_transit", updatedAt: now }).where(inArray(bookItems.id, ids))
      ),
      ...chunkRows<string>(bundleIds, D1_INLIST_CHUNK_SIZE).map((ids) =>
        database.update(packageItems).set({ status: "dispatched", updatedAt: now }).where(inArray(packageItems.id, ids))
      ),
      database
        .update(transferShipments)
        .set({ status: "in_transit", dispatchedAt: now, updatedAt: now })
        .where(eq(transferShipments.id, id)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pengiriman transfer");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const [updated] = await database.select().from(transferShipments).where(eq(transferShipments.id, id));

  return { ok: true, shipment: updated };
}

export async function receiveShipment(
  database: AppDatabase,
  id: string,
  looseReceipts: LooseReceipt[],
  bundleReceipts: BundleReceipt[]
): Promise<{ ok: true; shipment: any } | ServiceError> {
  const [shipment] = await database.select().from(transferShipments).where(eq(transferShipments.id, id));

  if (!shipment) {
    return { ok: false, status: 404, message: "Shipment not found" };
  }
  if (shipment.status !== "in_transit") {
    return { ok: false, status: 400, message: "Only in_transit shipments can be received" };
  }

  // Validasi pra-tulis: receipt asing ditolak 400 sebelum tulis apa pun.
  const lines = await database
    .select()
    .from(transferShipmentItems)
    .where(eq(transferShipmentItems.shipmentId, id));
  const looseSet = new Set(lines.filter((l: any) => l.bookItemId).map((l: any) => l.bookItemId as string));
  const bundleSet = new Set(lines.filter((l: any) => l.packageItemId).map((l: any) => l.packageItemId as string));
  const badLoose = looseReceipts.find((r) => !looseSet.has(r.bookItemId));
  if (badLoose) return { ok: false, status: 400, message: `Item ${badLoose.bookItemId} is not part of this shipment` };
  const badBundle = bundleReceipts.find((r) => !bundleSet.has(r.packageItemId));
  if (badBundle) return { ok: false, status: 400, message: `Package ${badBundle.packageItemId} is not part of this shipment` };

  const now = new Date().toISOString();
  const hasDiscrepancy = [...looseReceipts, ...bundleReceipts].some((r) => r.condition !== "good");

  // Kumpulkan seluruh tulis (kondisi per baris berbeda) lalu satu batch atomik
  // via seam lib/d1-write — tanpa await-per-baris, tanpa .returning() (§10 D1).
  const lineWrites = [
    ...looseReceipts.map((r) =>
      database
        .update(transferShipmentItems)
        .set({ receivedCondition: r.condition, notes: r.notes })
        .where(and(eq(transferShipmentItems.shipmentId, id), eq(transferShipmentItems.bookItemId, r.bookItemId)))
    ),
    ...bundleReceipts.map((r) =>
      database
        .update(transferShipmentItems)
        .set({ receivedCondition: r.condition, notes: r.notes })
        .where(and(eq(transferShipmentItems.shipmentId, id), eq(transferShipmentItems.packageItemId, r.packageItemId)))
    ),
  ];
  const looseWrites = looseReceipts.map((r) => {
    const patch: Partial<typeof bookItems.$inferInsert> =
      r.condition === "missing"
        ? { status: "lost", updatedAt: now }
        : r.condition === "damaged"
          ? { currentSchoolId: shipment.toSchoolId, status: "in_stock", condition: "damaged", updatedAt: now }
          : { currentSchoolId: shipment.toSchoolId, status: "in_stock", updatedAt: now };
    return database.update(bookItems).set(patch).where(eq(bookItems.id, r.bookItemId));
  });
  const missingBundleIds = bundleReceipts.filter((r) => r.condition === "missing").map((r) => r.packageItemId);
  const bundleWrites = [
    ...chunkRows<string>(missingBundleIds, D1_INLIST_CHUNK_SIZE).map((ids) =>
      database.delete(packageItems).where(inArray(packageItems.id, ids))
    ),
    ...bundleReceipts.filter((r) => r.condition !== "missing").map((r) => {
      const patch: Partial<typeof packageItems.$inferInsert> =
        r.condition === "damaged"
          ? { currentSchoolId: shipment.toSchoolId, status: "in_stock", notes: r.notes ? `Rusak saat transit: ${r.notes}` : "Rusak saat transit", updatedAt: now }
          : { currentSchoolId: shipment.toSchoolId, status: "in_stock", updatedAt: now };
      return database.update(packageItems).set(patch).where(eq(packageItems.id, r.packageItemId));
    }),
  ];

  try {
    await runWriteBatch(database, [
      ...lineWrites,
      ...looseWrites,
      ...bundleWrites,
      database
        .update(transferShipments)
        .set({ status: hasDiscrepancy ? "completed_with_discrepancy" : "completed", receivedAt: now, updatedAt: now })
        .where(eq(transferShipments.id, id)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penerimaan transfer");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const [completed] = await database.select().from(transferShipments).where(eq(transferShipments.id, id));

  return { ok: true, shipment: completed };
}

/**
 * Deep module: rollback penghapusan shipment (ganti logika inline di route).
 * In_transit dikembalikan ke in_stock di asal, lalu lines + header dihapus —
 * seluruhnya satu batch atomik via seam lib/d1-write (§10 D1).
 */
export async function rollbackShipment(
  database: AppDatabase,
  id: string
): Promise<{ ok: true } | ServiceError> {
  const [shipment] = await database.select().from(transferShipments).where(eq(transferShipments.id, id));
  if (!shipment) return { ok: false, status: 404, message: "Shipment not found" };
  if (shipment.status === "completed" || shipment.status === "completed_with_discrepancy") {
    return {
      ok: false,
      status: 400,
      message: `Surat jalan transfer "${shipment.shipmentNumber}" tidak dapat dihapus karena sudah selesai diterima (Completed) oleh cabang tujuan. Data pergerakan stok telah resmi tercatat.`,
    };
  }

  const items = await database
    .select()
    .from(transferShipmentItems)
    .where(eq(transferShipmentItems.shipmentId, id));
  const looseIds = items.filter((i: any) => i.itemType !== "package" && i.bookItemId).map((i: any) => i.bookItemId as string);
  const bundleIds = items.filter((i: any) => i.itemType === "package" && i.packageItemId).map((i: any) => i.packageItemId as string);
  const restore = shipment.status === "in_transit";

  try {
    await runWriteBatch(database, [
      ...(restore
        ? chunkRows<string>(looseIds, D1_INLIST_CHUNK_SIZE).map((ids) =>
            database.update(bookItems).set({ status: "in_stock" }).where(inArray(bookItems.id, ids))
          )
        : []),
      ...(restore
        ? chunkRows<string>(bundleIds, D1_INLIST_CHUNK_SIZE).map((ids) =>
            database.update(packageItems).set({ status: "in_stock" }).where(inArray(packageItems.id, ids))
          )
        : []),
      database.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, id)),
      database.delete(transferShipments).where(eq(transferShipments.id, id)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penghapusan transfer");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return { ok: true };
}
