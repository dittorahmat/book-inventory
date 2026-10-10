import { eq, and, or, desc, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { transferShipments, transferShipmentItems, bookItems, packageItems, schools, books, bookPackages } from "../../db/schema";
import { calcLineTotal } from "../../lib/transfer-pricing";

/** Batas daftar Transfer Shipment (§11): partisi + LIMIT 10–50, default 50. */
export const SHIPMENT_LIST_LIMIT = 50;

export interface ShipmentListFilter {
  schoolId?: string;
  status?: string;
  limit?: number;
}

/**
 * Satu-satunya pemilik daftar Transfer Shipment: partisi sekolah
 * (`from`/`to` = sekolah) + filter status + LIMIT didorong ke WHERE SQL
 * memakai indeks komposit (shipments_from/to_status_idx) — bukan
 * select-all + filter JS (§11 anti Pindai Penuh).
 */
export async function listShipmentsWithCounts(database: AppDatabase, filter: ShipmentListFilter = {}) {
  const limit = Math.min(Math.max(filter.limit ?? SHIPMENT_LIST_LIMIT, 1), SHIPMENT_LIST_LIMIT);
  const conditions = [];
  if (filter.schoolId) {
    conditions.push(
      or(
        eq(transferShipments.fromSchoolId, filter.schoolId),
        eq(transferShipments.toSchoolId, filter.schoolId)
      )
    );
  }
  if (filter.status && filter.status !== "all") {
    conditions.push(eq(transferShipments.status, filter.status as "draft"));
  }

  const rows = await database.select({
    id: transferShipments.id,
    shipmentNumber: transferShipments.shipmentNumber,
    status: transferShipments.status,
    fromSchoolId: transferShipments.fromSchoolId,
    toSchoolId: transferShipments.toSchoolId,
    totalDeclaredValue: transferShipments.totalDeclaredValue,
    dispatchedAt: transferShipments.dispatchedAt,
    receivedAt: transferShipments.receivedAt,
    notes: transferShipments.notes,
    reason: transferShipments.reason,
    createdAt: transferShipments.createdAt,
  }).from(transferShipments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transferShipments.createdAt))
    .limit(limit);

  const ids = rows.map((s: { id: string }) => s.id);
  if (ids.length === 0) return [];

  const lines = await database.select({
    shipmentId: transferShipmentItems.shipmentId,
    itemType: transferShipmentItems.itemType,
  }).from(transferShipmentItems).where(inArray(transferShipmentItems.shipmentId, ids));

  const counts = lines.reduce((m: Map<string, { looseCount: number; packageCount: number }>, l: { shipmentId: string; itemType: string }) => {
    const e = m.get(l.shipmentId) || { looseCount: 0, packageCount: 0 };
    if (l.itemType === "package") e.packageCount += 1;
    else e.looseCount += 1;
    return m.set(l.shipmentId, e);
  }, new Map());

  return rows.map((s: { id: string }) => ({
    ...s,
    looseCount: counts.get(s.id)?.looseCount || 0,
    packageCount: counts.get(s.id)?.packageCount || 0,
  }));
}

export async function getShipmentDetail(database: AppDatabase, id: string) {
  const rows = await database.select().from(transferShipments).where(eq(transferShipments.id, id));
  const shipment = rows[0];
  if (!shipment) return null;

  const lines = await database.select().from(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, id));
  const hasLoose = lines.some((l: any) => l.itemType !== "package");
  const hasPackage = lines.some((l: any) => l.itemType === "package");

  const looseItems = !hasLoose ? [] : await database
    .select({
      id: transferShipmentItems.id,
      bookItemId: transferShipmentItems.bookItemId,
      receivedCondition: transferShipmentItems.receivedCondition,
      quantity: transferShipmentItems.quantity,
      unitPriceSnapshot: transferShipmentItems.unitPriceSnapshot,
      barcode: bookItems.barcode,
      condition: bookItems.condition,
      bookTitle: books.title,
    })
    .from(transferShipmentItems)
    .leftJoin(bookItems, eq(transferShipmentItems.bookItemId, bookItems.id))
    .leftJoin(books, eq(bookItems.bookId, books.id))
    .where(and(
      eq(transferShipmentItems.shipmentId, id),
      eq(transferShipmentItems.itemType, "loose")
    ));

  const pkgItems = !hasPackage ? [] : await database
    .select({
      id: transferShipmentItems.id,
      packageId: transferShipmentItems.packageId,
      packageItemId: transferShipmentItems.packageItemId,
      receivedCondition: transferShipmentItems.receivedCondition,
      quantity: transferShipmentItems.quantity,
      unitPriceSnapshot: transferShipmentItems.unitPriceSnapshot,
      bundleBarcode: packageItems.barcode,
      bundleStatus: packageItems.status,
      packageCode: bookPackages.code,
      packageName: bookPackages.name,
    })
    .from(transferShipmentItems)
    .leftJoin(packageItems, eq(transferShipmentItems.packageItemId, packageItems.id))
    .leftJoin(bookPackages, eq(transferShipmentItems.packageId, bookPackages.id))
    .where(and(
      eq(transferShipmentItems.shipmentId, id),
      eq(transferShipmentItems.itemType, "package")
    ));

  const items = [
    ...looseItems.map((i: any) => ({
      ...i,
      itemType: "loose" as const,
      lineTotal: calcLineTotal(i.unitPriceSnapshot, i.quantity),
    })),
    ...pkgItems.map((i: any) => ({
      ...i,
      itemType: "package" as const,
      bookTitle: i.packageName,
      barcode: i.bundleBarcode || i.packageCode,
      lineTotal: calcLineTotal(i.unitPriceSnapshot, i.quantity),
    })),
  ];

  const [fromRows, toRows] = await Promise.all([
    database.select().from(schools).where(eq(schools.id, shipment.fromSchoolId)),
    database.select().from(schools).where(eq(schools.id, shipment.toSchoolId)),
  ]);

  return { ...shipment, fromSchool: fromRows[0], toSchool: toRows[0], items };
}
