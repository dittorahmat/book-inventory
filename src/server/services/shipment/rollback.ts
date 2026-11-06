import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { transferShipments, transferShipmentItems, bookItems, packageItems } from "../../../db/schema";
import { chunkRows, D1_INLIST_CHUNK_SIZE, d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import type { ServiceError } from "./write";

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
  const looseIds = items
    .filter((i) => i.itemType !== "package" && i.bookItemId)
    .map((i) => i.bookItemId as string);
  const bundleIds = items
    .filter((i) => i.itemType === "package" && i.packageItemId)
    .map((i) => i.packageItemId as string);
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
