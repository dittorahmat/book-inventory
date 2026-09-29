import { eq, and } from "drizzle-orm";
import { transferShipments, transferShipmentItems, bookItems, packageItems, schools, books, bookPackages } from "../../db/schema";

export async function listShipmentsWithCounts(database: any, schoolId?: string) {
  const all = await database.select({
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
  }).from(transferShipments);

  const filtered = schoolId
    ? all.filter((s: any) => s.fromSchoolId === schoolId || s.toSchoolId === schoolId)
    : all;

  const allLines = await database.select({
    shipmentId: transferShipmentItems.shipmentId,
    itemType: transferShipmentItems.itemType,
  }).from(transferShipmentItems);

  const counts = new Map<string, { looseCount: number; packageCount: number }>();
  for (const l of allLines) {
    const e = counts.get(l.shipmentId) || { looseCount: 0, packageCount: 0 };
    if (l.itemType === "package") e.packageCount += 1;
    else e.looseCount += 1;
    counts.set(l.shipmentId, e);
  }

  return filtered.map((s: any) => ({
    ...s,
    looseCount: counts.get(s.id)?.looseCount || 0,
    packageCount: counts.get(s.id)?.packageCount || 0,
  }));
}

export async function getShipmentDetail(database: any, id: string) {
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
      lineTotal: (i.unitPriceSnapshot || 0) * (i.quantity || 1),
    })),
    ...pkgItems.map((i: any) => ({
      ...i,
      itemType: "package" as const,
      bookTitle: i.packageName,
      barcode: i.bundleBarcode || i.packageCode,
      lineTotal: (i.unitPriceSnapshot || 0) * (i.quantity || 1),
    })),
  ];

  const fromRows = await database.select().from(schools).where(eq(schools.id, shipment.fromSchoolId));
  const toRows = await database.select().from(schools).where(eq(schools.id, shipment.toSchoolId));

  return { ...shipment, fromSchool: fromRows[0], toSchool: toRows[0], items };
}
