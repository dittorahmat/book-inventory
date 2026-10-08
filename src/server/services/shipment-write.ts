import { eq, inArray, and } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { transferShipments, transferShipmentItems, bookItems, packageItems, books, bookPackages } from "../../db/schema";
import { calcHeaderTotal } from "../../lib/transfer-pricing";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { resolveShipmentLines, type ShipmentLineInput } from "./stock-allocation";

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
  const shipmentNumber = `TRF-${Date.now().toString().slice(-6)}`;

  // Input kuantitas -> eksemplar fisik tertua (FIFO).
  const dedupe = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];
  let looseIds = input.bookItemIds ?? [];
  let bundleIds = [...new Set(input.packageItemIds ?? [])];
  if (input.items && input.items.length > 0) {
    const resolved = await resolveShipmentLines(input.fromSchoolId, input.items, database);
    if (!resolved.ok) return { ok: false, status: resolved.status, message: resolved.message };
    looseIds = dedupe(looseIds, resolved.looseIds);
    bundleIds = dedupe(bundleIds, resolved.bundleIds);
  }

  const looseSnapshots = new Map<string, number>();
  if (looseIds.length > 0) {
    const selectedItems = await database
      .select()
      .from(bookItems)
      .where(inArray(bookItems.id, looseIds));

    if (selectedItems.length !== looseIds.length) {
      return { ok: false, status: 400, message: "Some book items do not exist" };
    }

    const invalid = selectedItems.find(
      (item: any) => item.currentSchoolId !== input.fromSchoolId || item.status !== "in_stock"
    );
    if (invalid) {
      return { ok: false, status: 400, message: `Item ${invalid.barcode} is not in stock at origin school` };
    }

    const bookIds = [...new Set(selectedItems.map((i: any) => i.bookId as string))] as string[];
    const priceRows = await database
      .select({ id: books.id, price: books.price, buyPrice: books.buyPrice, sellPrice: books.sellPrice })
      .from(books)
      .where(inArray(books.id, bookIds));
    const priceMap = new Map<string, number>(priceRows.map((r: any) => [r.id as string, effectiveSellPrice(r)]));
    selectedItems.forEach((item: any) => looseSnapshots.set(item.id, priceMap.get(item.bookId) || 0));
  }

  const bundleSnapshots = new Map<string, { packageId: string; snapshot: number }>();
  if (bundleIds.length > 0) {
    const selectedBundles = await database
      .select()
      .from(packageItems)
      .where(inArray(packageItems.id, bundleIds));

    if (selectedBundles.length !== bundleIds.length) {
      return { ok: false, status: 400, message: "Some packages do not exist" };
    }

    const invalidBundle = selectedBundles.find(
      (b: any) => b.currentSchoolId !== input.fromSchoolId || b.status !== "in_stock"
    );
    if (invalidBundle) {
      return { ok: false, status: 400, message: `Package ${(invalidBundle as any).barcode} is not ready (in_stock) at origin school` };
    }

    const masterIds = [...new Set(selectedBundles.map((b: any) => b.packageId as string))] as string[];
    const masterRows = await database.select().from(bookPackages).where(inArray(bookPackages.id, masterIds));
    const masterMap = new Map<string, number>(masterRows.map((r: any) => [r.id as string, (r.price || 0) as number]));
    selectedBundles.forEach((b: any) => bundleSnapshots.set(b.id, { packageId: b.packageId, snapshot: masterMap.get(b.packageId) || 0 }));
  }

  // Tulis induk + anak atomik via seam lib/d1-write (batch di D1, sekuensial
  // di bun-sqlite). Total dihitung dulu agar cukup satu INSERT shipment —
  // tanpa update susulan + .returning() yang rapuh di D1.
  const looseLines = looseIds.map((bookItemId) => ({ bookItemId, snapshot: looseSnapshots.get(bookItemId) || 0 }));
  const bundleLines = bundleIds.flatMap((packageItemId) => {
    const meta = bundleSnapshots.get(packageItemId);
    return meta ? [{ packageItemId, meta }] : [];
  });
  const valuedLines = [
    ...looseLines.map((l) => ({ unitPriceSnapshot: l.snapshot, quantity: 1 })),
    ...bundleLines.map((l) => ({ unitPriceSnapshot: l.meta.snapshot, quantity: 1 })),
  ];
  const total = calcHeaderTotal(valuedLines);

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
      ...looseLines.map((l) =>
        database.insert(transferShipmentItems).values({
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
        })
      ),
      ...bundleLines.map((l) =>
        database.insert(transferShipmentItems).values({
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
        })
      ),
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

  const looseIds = items.filter((i: any) => i.itemType !== "package" && i.bookItemId).map((i: any) => i.bookItemId);
  const bundleIds = items.filter((i: any) => i.itemType === "package" && i.packageItemId).map((i: any) => i.packageItemId);

  if (looseIds.length > 0) {
    await database
      .update(bookItems)
      .set({ status: "in_transit", updatedAt: now })
      .where(inArray(bookItems.id, looseIds));
  }

  if (bundleIds.length > 0) {
    await database
      .update(packageItems)
      .set({ status: "dispatched", updatedAt: now })
      .where(inArray(packageItems.id, bundleIds));
  }

  const [updated] = await database
    .update(transferShipments)
    .set({ status: "in_transit", dispatchedAt: now, updatedAt: now })
    .where(eq(transferShipments.id, id))
    .returning();

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

  const now = new Date().toISOString();
  let hasDiscrepancy = false;

  for (const receipt of looseReceipts) {
    await database
      .update(transferShipmentItems)
      .set({ receivedCondition: receipt.condition, notes: receipt.notes })
      .where(
        and(
          eq(transferShipmentItems.shipmentId, id),
          eq(transferShipmentItems.bookItemId, receipt.bookItemId)
        )
      );

    if (receipt.condition === "missing") {
      hasDiscrepancy = true;
      await database
        .update(bookItems)
        .set({ status: "lost", updatedAt: now })
        .where(eq(bookItems.id, receipt.bookItemId));
    } else if (receipt.condition === "damaged") {
      hasDiscrepancy = true;
      await database
        .update(bookItems)
        .set({
          currentSchoolId: shipment.toSchoolId,
          status: "in_stock",
          condition: "damaged",
          updatedAt: now,
        })
        .where(eq(bookItems.id, receipt.bookItemId));
    } else {
      await database
        .update(bookItems)
        .set({
          currentSchoolId: shipment.toSchoolId,
          status: "in_stock",
          updatedAt: now,
        })
        .where(eq(bookItems.id, receipt.bookItemId));
    }
  }

  for (const receipt of bundleReceipts) {
    await database
      .update(transferShipmentItems)
      .set({ receivedCondition: receipt.condition, notes: receipt.notes })
      .where(
        and(
          eq(transferShipmentItems.shipmentId, id),
          eq(transferShipmentItems.packageItemId, receipt.packageItemId)
        )
      );

    if (receipt.condition === "missing") {
      hasDiscrepancy = true;
      await database.delete(packageItems).where(eq(packageItems.id, receipt.packageItemId));
    } else if (receipt.condition === "damaged") {
      hasDiscrepancy = true;
      await database
        .update(packageItems)
        .set({
          currentSchoolId: shipment.toSchoolId,
          status: "in_stock",
          notes: receipt.notes ? `Rusak saat transit: ${receipt.notes}` : "Rusak saat transit",
          updatedAt: now,
        })
        .where(eq(packageItems.id, receipt.packageItemId));
    } else {
      await database
        .update(packageItems)
        .set({
          currentSchoolId: shipment.toSchoolId,
          status: "in_stock",
          updatedAt: now,
        })
        .where(eq(packageItems.id, receipt.packageItemId));
    }
  }

  const finalStatus = hasDiscrepancy ? "completed_with_discrepancy" : "completed";

  const [completed] = await database
    .update(transferShipments)
    .set({
      status: finalStatus,
      receivedAt: now,
      updatedAt: now,
    })
    .where(eq(transferShipments.id, id))
    .returning();

  return { ok: true, shipment: completed };
}
