import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { internalShipmentItems, internalShipments, packageStocks } from "../../../db/schema";
import { moveInventoryStock } from "../stock";
import { d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";

export interface StockValidationLine {
  packageId?: string | null;
  bookId?: string | null;
  quantity: number;
}

export interface StockValidationResult {
  ok: boolean;
  message?: string;
}

/**
 * Validasi ketersediaan saldo stok sebelum mutasi penerbitan pengiriman.
 * Memeriksa seluruh baris sekaligus untuk mencegah mutasi parsial jika salah satu baris kurang.
 */
export async function validateStockAvailability(
  database: AppDatabase,
  schoolId: string,
  lines: StockValidationLine[]
): Promise<StockValidationResult> {
  const packageIds = [...new Set(lines.map((l) => l.packageId).filter((id): id is string => Boolean(id)))];
  if (packageIds.length === 0) return { ok: true };

  const currentStocks = await database
    .select({
      packageId: packageStocks.packageId,
      availableQuantity: packageStocks.availableQuantity,
    })
    .from(packageStocks)
    .where(eq(packageStocks.schoolId, schoolId));

  const stockMap = new Map(currentStocks.map((s) => [s.packageId, s.availableQuantity ?? 0]));

  const demandMap = new Map<string, number>();
  for (const line of lines) {
    if (line.packageId) {
      demandMap.set(line.packageId, (demandMap.get(line.packageId) ?? 0) + line.quantity);
    }
  }

  for (const [pkgId, needed] of demandMap.entries()) {
    const available = stockMap.get(pkgId) ?? 0;
    if (available < needed) {
      return {
        ok: false,
        message: `Stok paket di gudang asal tidak mencukupi (tersedia: ${available}, dibutuhkan: ${needed}).`,
      };
    }
  }

  return { ok: true };
}

/**
 * Menerapkan mutasi stok keluar (transfer_dispatch) untuk sekumpulan baris pengiriman.
 */
export async function dispatchShipmentStock(
  database: AppDatabase,
  sourceSchoolId: string,
  lines: StockValidationLine[]
): Promise<StockValidationResult> {
  const check = await validateStockAvailability(database, sourceSchoolId, lines);
  if (!check.ok) return check;

  const applied: StockValidationLine[] = [];
  for (const line of lines) {
    if (line.packageId) {
      const res = await moveInventoryStock(database, {
        movementType: "transfer_dispatch",
        itemType: "package",
        packageId: line.packageId,
        fromSchoolId: sourceSchoolId,
        quantity: line.quantity,
      });
      if (!res.ok) {
        // Rollback yang sudah diterapkan
        for (const rb of applied) {
          if (rb.packageId) {
            await moveInventoryStock(database, {
              movementType: "transfer_receive",
              itemType: "package",
              packageId: rb.packageId,
              toSchoolId: sourceSchoolId,
              quantity: rb.quantity,
            });
          }
        }
        return { ok: false, message: res.message || "Gagal memotong stok gudang asal" };
      }
      applied.push(line);
    }
  }

  return { ok: true };
}

export interface CancelShipmentResult {
  ok: boolean;
  status: 200 | 400 | 404;
  message: string;
}

/**
 * Membatalkan Surat Jalan Internal berstatus `in_transit`.
 * Mengembalikan stok paket yang sedang in-transit ke gudang asal dan menghapus/membatalkan shipment.
 */
export async function cancelInternalShipment(
  database: AppDatabase,
  shipmentId: string,
  sourceSchoolId: string
): Promise<CancelShipmentResult> {
  const [shipment] = await database
    .select()
    .from(internalShipments)
    .where(eq(internalShipments.id, shipmentId));

  if (!shipment) {
    return { ok: false, status: 404, message: "Surat Jalan Internal tidak ditemukan" };
  }
  if (shipment.status !== "in_transit") {
    return {
      ok: false,
      status: 400,
      message: `Surat Jalan dengan status "${shipment.status}" tidak dapat dibatalkan (hanya berstatus in_transit).`,
    };
  }

  const items = await database
    .select()
    .from(internalShipmentItems)
    .where(eq(internalShipmentItems.shipmentId, shipmentId));

  // Restorasi stok in-transit ke gudang asal via moveInventoryStock (transfer_receive)
  for (const item of items) {
    if (item.packageId) {
      await moveInventoryStock(database, {
        movementType: "transfer_receive",
        itemType: "package",
        packageId: item.packageId,
        toSchoolId: sourceSchoolId,
        quantity: item.quantity,
      });
    }
  }

  try {
    await runWriteBatch(database, [
      database
        .delete(internalShipmentItems)
        .where(eq(internalShipmentItems.shipmentId, shipmentId)),
      database
        .delete(internalShipments)
        .where(eq(internalShipments.id, shipmentId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pembatalan Surat Jalan Internal");
    if (mapped) return { ok: false, status: 400, message: mapped.message };
    throw err;
  }

  return {
    ok: true,
    status: 200,
    message: `Surat Jalan ${shipment.deliveryNoteNumber} berhasil dibatalkan dan stok dikembalikan ke gudang asal.`,
  };
}
