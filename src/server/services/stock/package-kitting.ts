import { and, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import {
  bookPackages,
  bookPackageItems,
  packageItems,
  books,
  bookItems,
  bookStocks,
  packageStocks,
} from "../../../db/schema";
import {
  chunkRows,
  D1_INLIST_CHUNK_SIZE,
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";
import { isoTimeFragment } from "../../lib/document-number";
import { SCHOOL_IDS } from "../../lib/school-constants";
import { kitBomWithoutWpr } from "../pricing";
import { AVAILABLE_LOOSE_STATUSES, KITTABLE_CONDITIONS, READY_BUNDLE_STATUSES } from "./index";
import { moveInventoryStock } from "./movement";

export type KittingError = { ok: false; status: ContentfulStatusCode; message: string };

export type KitPackageOptions =
  | {
      mode: "assemble";
      schoolId: string;
      packageId: string;
      quantity: number;
    }
  | {
      mode: "disassemble";
      schoolId: string;
      packageId: string;
      quantity: number;
      reason: string;
    }
  | {
      mode: "recall";
      packageId: string;
      branchSchoolId: string;
      quantity: number;
      reason: string;
      destinationSchoolId?: string;
    };

export type KitPackageResult =
  | {
      ok: true;
      data: {
        packageId: string;
        mode: "assemble" | "disassemble" | "recall";
        quantity: number;
        assembledItems?: Array<{ id: string; barcode: string }>;
        restoredLooseCount?: number;
      };
    }
  | KittingError;

/**
 * Deep Module: Seam tunggal untuk perakitan fisik (kitting), pembongkaran (unbundling),
 * dan penarikan cabang (recall & auto-unbundle) paket buku.
 * Mengenkapsulasi:
 * 1. Filter komponen non-fisik WPR (§0.28).
 * 2. Cek ketersediaan stok agregat & fisik.
 * 3. Eksekusi atomik mutasi stok agregat via single-writer moveInventoryStock (§0.62).
 * 4. Sinkronisasi baris unit fisik di package_items dan book_items.
 */
export async function kitPackage(
  database: AppDatabase,
  options: KitPackageOptions,
  deps?: WriteDeps
): Promise<KitPackageResult> {
  const now = writeNow(deps);
  const { mode, packageId, quantity } = options;

  const [pkg] = await database.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return { ok: false, status: 404, message: "Package not found" };
  }

  const rawBom = await database
    .select({
      bookId: bookPackageItems.bookId,
      quantity: bookPackageItems.quantity,
      title: books.title,
      isbn: books.isbn,
    })
    .from(bookPackageItems)
    .innerJoin(books, eq(bookPackageItems.bookId, books.id))
    .where(eq(bookPackageItems.packageId, packageId));

  if (rawBom.length === 0) {
    return { ok: false, status: 400, message: "Package has no BOM components" };
  }

  const kitBom = kitBomWithoutWpr<{ bookId: string; quantity: number; title: string; isbn: string }>(rawBom);

  if (mode === "assemble") {
    const { schoolId } = options;
    const neededByBook = new Map<string, number>();
    for (const item of kitBom) {
      neededByBook.set(item.bookId, (neededByBook.get(item.bookId) ?? 0) + item.quantity * quantity);
    }
    const bookIds = [...neededByBook.keys()];

    const aggrStocks = await database
      .select({ bookId: bookStocks.bookId, availableQuantity: bookStocks.availableQuantity })
      .from(bookStocks)
      .where(and(eq(bookStocks.schoolId, schoolId), inArray(bookStocks.bookId, bookIds)));
    const aggrStockMap = new Map<string, number>(aggrStocks.map((s) => [s.bookId, s.availableQuantity ?? 0]));

    const candidates = await database
      .select({ id: bookItems.id, bookId: bookItems.bookId })
      .from(bookItems)
      .where(
        and(
          inArray(bookItems.bookId, bookIds),
          eq(bookItems.currentSchoolId, schoolId),
          inArray(bookItems.status, [...AVAILABLE_LOOSE_STATUSES]),
          inArray(bookItems.condition, [...KITTABLE_CONDITIONS])
        )
      );

    const availableByBook = new Map<string, Array<{ id: string }>>();
    for (const c of candidates) {
      const list = availableByBook.get(c.bookId) ?? [];
      list.push({ id: c.id });
      availableByBook.set(c.bookId, list);
    }

    for (const item of kitBom) {
      const requiredTotal = neededByBook.get(item.bookId) ?? 0;
      const physicalCount = availableByBook.get(item.bookId)?.length ?? 0;
      const aggrCount = aggrStockMap.get(item.bookId);
      const availableCount = Math.max(aggrCount ?? 0, physicalCount);
      if (availableCount < requiredTotal) {
        return {
          ok: false,
          status: 400,
          message: `Insufficient stock for "${item.title}". Required: ${requiredTotal}, Available: ${availableCount}`,
        };
      }
    }

    const consumeWrites = [];
    for (const item of kitBom) {
      const requiredTotal = neededByBook.get(item.bookId) ?? 0;
      const physicalItems = availableByBook.get(item.bookId) ?? [];
      if (physicalItems.length > 0) {
        const idsToConsume = physicalItems.slice(0, requiredTotal).map((c) => c.id);
        for (const ids of chunkRows(idsToConsume, D1_INLIST_CHUNK_SIZE)) {
          consumeWrites.push(
            database
              .update(bookItems)
              .set({ status: "disposed", notes: `Bundled into ${pkg.name}`, updatedAt: now })
              .where(inArray(bookItems.id, ids))
          );
        }
      }
    }

    const createdPackageItems: Array<{ id: string; barcode: string }> = [];
    const itemsToInsert: Array<typeof packageItems.$inferInsert> = [];
    const timeFrag = isoTimeFragment(now, 6);

    for (let i = 0; i < quantity; i++) {
      const pItemId = newWriteId(deps);
      const idFrag = pItemId.replace(/-/g, "").slice(0, 8).padEnd(8, "0");
      const itemBarcode = `PKG-${pkg.code}-${timeFrag}-${idFrag}-${(i + 1).toString().padStart(3, "0")}`;
      itemsToInsert.push({
        id: pItemId,
        packageId,
        currentSchoolId: schoolId,
        barcode: itemBarcode,
        status: "in_stock",
        notes: "Assembled via kitting operation",
        createdAt: now,
        updatedAt: now,
      });
      createdPackageItems.push({ id: pItemId, barcode: itemBarcode });
    }

    try {
      const writes = [
        ...consumeWrites,
        ...chunkRows(itemsToInsert).map((rows) => database.insert(packageItems).values(rows)),
      ];
      if (writes.length > 0) {
        await runWriteBatch(database, writes);
      }

      await moveInventoryStock(
        database,
        {
          movementType: "assembly",
          itemType: "package",
          packageId,
          schoolId,
          quantity,
        },
        deps
      );
      for (const comp of kitBom) {
        await moveInventoryStock(
          database,
          {
            movementType: "handover",
            itemType: "loose",
            bookId: comp.bookId,
            schoolId,
            quantity: comp.quantity * quantity,
          },
          deps
        );
      }
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "perakitan paket");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }

    return {
      ok: true,
      data: {
        packageId,
        mode: "assemble",
        quantity,
        assembledItems: createdPackageItems,
      },
    };
  }

  // mode is disassemble or recall
  const fromSchoolId = mode === "recall" ? options.branchSchoolId : options.schoolId;
  const toSchoolId = mode === "recall" ? (options.destinationSchoolId ?? SCHOOL_IDS.WAREHOUSE) : options.schoolId;
  const reason = options.reason;

  const [aggrPkgStock] = await database
    .select({ availableQuantity: packageStocks.availableQuantity })
    .from(packageStocks)
    .where(and(eq(packageStocks.packageId, packageId), eq(packageStocks.schoolId, fromSchoolId)));

  const availableBundles = await database
    .select({ id: packageItems.id })
    .from(packageItems)
    .where(
      and(
        eq(packageItems.packageId, packageId),
        eq(packageItems.currentSchoolId, fromSchoolId),
        inArray(packageItems.status, [...READY_BUNDLE_STATUSES])
      )
    )
    .limit(quantity);

  const physicalCount = availableBundles.length;
  const aggrCount = aggrPkgStock?.availableQuantity ?? 0;
  const availableCount = Math.max(aggrCount, physicalCount);

  if (availableCount < quantity) {
    const errorPrefix = mode === "recall" ? "Stok paket di cabang tidak mencukupi untuk ditarik" : "Not enough assembled packages to unbundle";
    return {
      ok: false,
      status: 400,
      message: `${errorPrefix}. Requested: ${quantity}, Available: ${availableCount}`,
    };
  }

  const unbundleWrites =
    availableBundles.length > 0
      ? chunkRows<string>(
          availableBundles.map((b) => b.id),
          D1_INLIST_CHUNK_SIZE
        ).map((ids) => database.delete(packageItems).where(inArray(packageItems.id, ids)))
      : [];

  const restoredBookItems: Array<typeof bookItems.$inferInsert> = [];
  const physicalBundlesToRestore = availableBundles.length;
  let totalRestoredLoose = 0;
  const timeFrag = isoTimeFragment(now, 6);

  if (physicalBundlesToRestore > 0) {
    for (const item of kitBom) {
      const returnCount = item.quantity * physicalBundlesToRestore;
      for (let j = 0; j < returnCount; j++) {
        const barcode = `RET-${mode === "recall" ? "WH" : "UNB"}-${timeFrag}-${Math.floor(Math.random() * 1000)}`;
        restoredBookItems.push({
          id: newWriteId(deps),
          bookId: item.bookId,
          currentSchoolId: toSchoolId,
          barcode,
          condition: "new",
          status: "in_stock",
          notes:
            mode === "recall"
              ? `Ditarik dari cabang ${fromSchoolId} & dibongkar ke gudang pusat. Alasan: ${reason}`
              : `Restored from unbundled package ${pkg.name}. Reason: ${reason}`,
          createdAt: now,
          updatedAt: now,
        });
        totalRestoredLoose++;
      }
    }
  }

  try {
    const writes = [
      ...unbundleWrites,
      ...chunkRows(restoredBookItems).map((rows) => database.insert(bookItems).values(rows)),
    ];
    if (writes.length > 0) {
      await runWriteBatch(database, writes);
    }

    await moveInventoryStock(
      database,
      {
        movementType: "disassembly",
        itemType: "package",
        packageId,
        schoolId: fromSchoolId,
        quantity,
      },
      deps
    );
    for (const item of kitBom) {
      await moveInventoryStock(
        database,
        {
          movementType: "receipt",
          itemType: "loose",
          bookId: item.bookId,
          toSchoolId,
          quantity: item.quantity * quantity,
        },
        deps
      );
    }
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, mode === "recall" ? "penarikan dan pembongkaran paket" : "pembongkaran paket");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const totalLooseFromBom = kitBom.reduce((acc, b) => acc + b.quantity, 0) * quantity;

  return {
    ok: true,
    data: {
      packageId,
      mode,
      quantity,
      restoredLooseCount: totalRestoredLoose || totalLooseFromBom,
    },
  };
}
