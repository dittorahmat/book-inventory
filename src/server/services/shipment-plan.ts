import { inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookItems, books, bookPackages, packageItems } from "../../db/schema";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { calcHeaderTotal } from "../../lib/transfer-pricing";
import { allocateLooseStock, allocatePackages } from "./stock-allocation";
import { isAvailableLoose, isReadyBundle } from "./stock-buckets";

export interface ShipmentLineInput {
  itemType: "loose" | "package";
  bookId?: string;
  packageId?: string;
  quantity: number;
}

export interface CreateLinesInput {
  items?: ShipmentLineInput[];
  bookItemIds?: string[];
  packageItemIds?: string[];
}

export type ShipmentPlanError = { ok: false; status: ContentfulStatusCode; message: string };

export interface PlannedCreateLines {
  looseIds: string[];
  bundleIds: string[];
  looseSnapshots: Map<string, number>;
  bundleSnapshots: Map<string, { packageId: string; snapshot: number }>;
  total: number;
}

/**
 * Perencana privat pembuatan Transfer Shipment (satu-satunya pengimpor:
 * shipment-write). Pick FIFO + validasi shippable + snapshot harga dalam
 * satu rencana: predikat validasi SAMA dengan predikat pick (seam
 * stock-buckets) sehingga keduanya tak bisa drift; snapshot dihitung sekali
 * agar tulis induk + anak cukup satu INSERT tanpa update susulan (§10 D1).
 */
export async function planCreateLines(
  database: AppDatabase,
  fromSchoolId: string,
  input: CreateLinesInput
): Promise<{ ok: true; plan: PlannedCreateLines } | ShipmentPlanError> {
  const dedupe = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];
  let looseIds = [...new Set(input.bookItemIds ?? [])];
  let bundleIds = [...new Set(input.packageItemIds ?? [])];
  if (input.items && input.items.length > 0) {
    const resolved = await resolveQuantityLines(fromSchoolId, input.items, database);
    if (!resolved.ok) return resolved;
    looseIds = dedupe(looseIds, resolved.looseIds);
    bundleIds = dedupe(bundleIds, resolved.bundleIds);
  }

  const looseSnapshots = new Map<string, number>();
  if (looseIds.length > 0) {
    type LooseRow = { id: string; bookId: string; barcode: string | null; currentSchoolId: string | null; status: string };
    const selectedItems: LooseRow[] = await database
      .select({
        id: bookItems.id,
        bookId: bookItems.bookId,
        barcode: bookItems.barcode,
        currentSchoolId: bookItems.currentSchoolId,
        status: bookItems.status,
      })
      .from(bookItems)
      .where(inArray(bookItems.id, looseIds));

    if (selectedItems.length !== looseIds.length) {
      return { ok: false, status: 400, message: "Some book items do not exist" };
    }

    const invalid = selectedItems.find(
      (item) => item.currentSchoolId !== fromSchoolId || !isAvailableLoose(item.status)
    );
    if (invalid) {
      return { ok: false, status: 400, message: `Item ${invalid.barcode} is not in stock at origin school` };
    }

    type PriceRow = { id: string; price: number; buyPrice: number; sellPrice: number };
    const bookIds = [...new Set(selectedItems.map((i) => i.bookId))];
    const priceRows: PriceRow[] = await database
      .select({ id: books.id, price: books.price, buyPrice: books.buyPrice, sellPrice: books.sellPrice })
      .from(books)
      .where(inArray(books.id, bookIds));
    const priceMap = new Map<string, number>(priceRows.map((r: PriceRow) => [r.id, effectiveSellPrice(r)]));
    selectedItems.forEach((item) => looseSnapshots.set(item.id, priceMap.get(item.bookId) || 0));
  }

  const bundleSnapshots = new Map<string, { packageId: string; snapshot: number }>();
  if (bundleIds.length > 0) {
    type BundleRow = { id: string; packageId: string; barcode: string | null; currentSchoolId: string | null; status: string };
    const selectedBundles: BundleRow[] = await database
      .select({
        id: packageItems.id,
        packageId: packageItems.packageId,
        barcode: packageItems.barcode,
        currentSchoolId: packageItems.currentSchoolId,
        status: packageItems.status,
      })
      .from(packageItems)
      .where(inArray(packageItems.id, bundleIds));

    if (selectedBundles.length !== bundleIds.length) {
      return { ok: false, status: 400, message: "Some packages do not exist" };
    }

    const invalidBundle = selectedBundles.find(
      (b) => b.currentSchoolId !== fromSchoolId || !isReadyBundle(b.status)
    );
    if (invalidBundle) {
      return { ok: false, status: 400, message: `Package ${invalidBundle.barcode} is not ready (in_stock) at origin school` };
    }

    type MasterRow = { id: string; price: number | null };
    const masterIds = [...new Set(selectedBundles.map((b) => b.packageId))];
    const masterRows: MasterRow[] = await database
      .select({ id: bookPackages.id, price: bookPackages.price })
      .from(bookPackages)
      .where(inArray(bookPackages.id, masterIds));
    const masterMap = new Map<string, number>(masterRows.map((r: MasterRow) => [r.id, r.price || 0]));
    selectedBundles.forEach((b) =>
      bundleSnapshots.set(b.id, { packageId: b.packageId, snapshot: masterMap.get(b.packageId) || 0 })
    );
  }

  const total = calcHeaderTotal([
    ...looseIds.map((bookItemId) => ({ unitPriceSnapshot: looseSnapshots.get(bookItemId) || 0, quantity: 1 })),
    ...bundleIds.flatMap((packageItemId) => {
      const meta = bundleSnapshots.get(packageItemId);
      return meta ? [{ unitPriceSnapshot: meta.snapshot, quantity: 1 }] : [];
    }),
  ]);

  return { ok: true, plan: { looseIds, bundleIds, looseSnapshots, bundleSnapshots, total } };
}

/** Kuantitas per judul/paket -> eksemplar fisik konkret (FIFO). Privat rencana ini. */
const resolveQuantityLines = async (
  fromSchoolId: string,
  lines: ShipmentLineInput[],
  database: AppDatabase
): Promise<{ ok: true; looseIds: string[]; bundleIds: string[] } | ShipmentPlanError> => {
  const looseIds: string[] = [];
  const bundleIds: string[] = [];

  for (const line of lines) {
    if (line.itemType === "loose") {
      if (!line.bookId) {
        return { ok: false, status: 400, message: "Baris buku satuan harus menyertakan bookId." };
      }
      const result = await allocateLooseStock(
        { bookId: line.bookId, schoolId: fromSchoolId, quantity: line.quantity },
        database
      );
      if (!result.ok) return { ok: false, status: result.status, message: result.message };
      looseIds.push(...result.items.map((i) => i.id));
      continue;
    }

    if (!line.packageId) {
      return { ok: false, status: 400, message: "Baris paket harus menyertakan packageId." };
    }
    const result = await allocatePackages(
      { packageId: line.packageId, schoolId: fromSchoolId, quantity: line.quantity },
      database
    );
    if (!result.ok) return { ok: false, status: result.status, message: result.message };
    bundleIds.push(...result.items.map((i) => i.id));
  }

  return { ok: true, looseIds, bundleIds };
};
