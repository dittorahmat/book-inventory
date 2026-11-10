import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookPackages, bookPackageItems, packageItems, packageStocks, bookItems } from "../../db/schema";
import { SCHOOL_IDS } from "../lib/school-constants";
import { runWriteBatch, type WriteDeps, writeNow, newWriteId, chunkRows, d1WriteErrorStatus } from "../lib/d1-write";
import { moveInventoryStock, READY_BUNDLE_STATUSES } from "./stock";
import { kitBomWithoutWpr } from "./pricing";
import type { DisassembleResult } from "./package-assembly";

export interface RecallUnbundlePayload {
  packageId: string;
  branchSchoolId: string;
  quantity: number;
  reason: string;
}

/**
 * Deep module: Penarikan sisa paket di cabang ke gudang pusat dan dibongkar
 * secara atomik menjadi buku satuan di gudang pusat sesuai Bill of Materials (BOM).
 * (Issue #386)
 */
export async function recallAndUnbundleBranchPackage(
  database: AppDatabase,
  payload: RecallUnbundlePayload,
  deps?: WriteDeps
): Promise<DisassembleResult> {
  const { packageId, branchSchoolId, quantity, reason } = payload;
  const now = writeNow(deps);

  const [pkg] = await database.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return { ok: false, status: 404, message: "Paket buku tidak ditemukan" };
  }

  // Cek ketersediaan paket di cabang (agregat package_stocks dan fisik package_items)
  const [branchPkgStock] = await database
    .select({ availableQuantity: packageStocks.availableQuantity })
    .from(packageStocks)
    .where(and(eq(packageStocks.packageId, packageId), eq(packageStocks.schoolId, branchSchoolId)));

  const availableBundles = await database
    .select({ id: packageItems.id })
    .from(packageItems)
    .where(
      and(
        eq(packageItems.packageId, packageId),
        eq(packageItems.currentSchoolId, branchSchoolId),
        inArray(packageItems.status, [...READY_BUNDLE_STATUSES])
      )
    )
    .limit(quantity);

  const physicalCount = availableBundles.length;
  const aggrCount = branchPkgStock?.availableQuantity ?? 0;
  const availableCount = Math.max(aggrCount, physicalCount);

  if (availableCount < quantity) {
    return {
      ok: false,
      status: 400,
      message: `Stok paket di cabang tidak mencukupi untuk ditarik. Diminta: ${quantity}, Tersedia: ${availableCount}`,
    };
  }

  const bom = await database
    .select({
      bookId: bookPackageItems.bookId,
      quantity: bookPackageItems.quantity,
    })
    .from(bookPackageItems)
    .where(eq(bookPackageItems.packageId, packageId));

  const effectiveBom = kitBomWithoutWpr<{ bookId: string; quantity: number }>(bom);

  const physicalBundlesToDisassemble = availableBundles.length;
  const unbundleWrites = physicalBundlesToDisassemble > 0
    ? chunkRows<string>(
        availableBundles.map((b) => b.id),
        50
      ).map((ids) => database.delete(packageItems).where(inArray(packageItems.id, ids)))
    : [];

  const restoredBookItems: Array<typeof bookItems.$inferInsert> = [];
  let totalRestoredLoose = 0;
  const warehouseSchoolId = SCHOOL_IDS.WAREHOUSE;

  if (physicalBundlesToDisassemble > 0) {
    const timeFrag = now.replace(/[-:T.Z]/g, "").slice(-6);
    for (const item of effectiveBom) {
      const returnCount = item.quantity * physicalBundlesToDisassemble;
      for (let j = 0; j < returnCount; j++) {
        const barcode = `RET-WH-${timeFrag}-${Math.floor(Math.random() * 1000)}`;
        restoredBookItems.push({
          id: newWriteId(deps),
          bookId: item.bookId,
          currentSchoolId: warehouseSchoolId,
          barcode,
          condition: "new",
          status: "in_stock",
          notes: `Ditarik dari cabang ${branchSchoolId} & dibongkar ke gudang pusat. Alasan: ${reason}`,
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

    // 1. Kurangi stok paket di cabang secara agregat
    await moveInventoryStock(
      database,
      {
        movementType: "disassembly",
        itemType: "package",
        packageId,
        schoolId: branchSchoolId,
        quantity,
      },
      deps
    );

    // 2. Tambahkan stok satuan buku ke gudang pusat secara agregat sesuai BOM
    for (const item of effectiveBom) {
      await moveInventoryStock(
        database,
        {
          movementType: "receipt",
          itemType: "loose",
          bookId: item.bookId,
          toSchoolId: warehouseSchoolId,
          quantity: item.quantity * quantity,
        },
        deps
      );
    }
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penarikan paket cabang ke gudang");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    data: {
      packageId,
      unbundledCount: quantity,
      restoredLooseCount: totalRestoredLoose || (effectiveBom.reduce((acc, b) => acc + b.quantity, 0) * quantity),
    },
  };
}
