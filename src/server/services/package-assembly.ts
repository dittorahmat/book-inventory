import { and, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookPackages, bookPackageItems, packageItems, books, bookItems } from "../../db/schema";
import { chunkRows, D1_INLIST_CHUNK_SIZE, d1WriteErrorStatus, newWriteId, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { isoTimeFragment } from "../lib/document-number";
import { kitBomWithoutWpr } from "./pricing";
import { AVAILABLE_LOOSE_STATUSES, KITTABLE_CONDITIONS, READY_BUNDLE_STATUSES } from "./stock";
import { adjustLooseStock, adjustPackageStock } from "./stock/aggregate";

export type AssemblyError = { ok: false; status: ContentfulStatusCode; message: string };

export type AssembleResult =
  | {
      ok: true;
      data: {
        packageId: string;
        quantityAssembled: number;
        assembledItems: Array<{ id: string; barcode: string }>;
      };
    }
  | AssemblyError;

export type DisassembleResult =
  | {
      ok: true;
      data: {
        packageId: string;
        unbundledCount: number;
        restoredLooseCount: number;
      };
    }
  | AssemblyError;

/**
 * Deep module: perakitan fisik paket buku (kitting).
 * Memverifikasi ketersediaan stok fisik kondisi baru dari seluruh komponen BOM,
 * menandai eksemplar satuan yang diserap (status: disposed),
 * dan mencetak bundel fisik baru ke package_items.
 */
export async function assemblePackageBundles(
  database: AppDatabase,
  packageId: string,
  schoolId: string,
  quantity: number,
  deps?: WriteDeps
): Promise<AssembleResult> {
  const now = writeNow(deps);

  const [pkg] = await database.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return { ok: false, status: 404, message: "Package not found" };
  }

  const bom = await database
    .select({
      bookId: bookPackageItems.bookId,
      quantity: bookPackageItems.quantity,
      title: books.title,
    })
    .from(bookPackageItems)
    .innerJoin(books, eq(bookPackageItems.bookId, books.id))
    .where(eq(bookPackageItems.packageId, packageId));

  if (bom.length === 0) {
    return { ok: false, status: 400, message: "Package has no BOM components" };
  }

  // WPR bukan fisik rakitan: dikecualikan dari konsumsi stok (tetap di BOM untuk harga).
  const kitBom = kitBomWithoutWpr<{ bookId: string; quantity: number; title: string }>(bom);

  // Verifikasi kecukupan stok semua komponen dalam SATU query batch.
  const neededByBook = new Map<string, number>();
  for (const item of kitBom) {
    neededByBook.set(item.bookId, (neededByBook.get(item.bookId) ?? 0) + item.quantity * quantity);
  }
  const candidates = await database
    .select({ id: bookItems.id, bookId: bookItems.bookId })
    .from(bookItems)
    .where(
      and(
        inArray(bookItems.bookId, [...neededByBook.keys()]),
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
    const availableCount = availableByBook.get(item.bookId)?.length ?? 0;
    if (availableCount < requiredTotal) {
      return {
        ok: false,
        status: 400,
        message: `Insufficient stock for "${item.title}". Required: ${requiredTotal}, Available: ${availableCount}`,
      };
    }
  }

  // Potong stok satuan batch: satu UPDATE per komponen per chunk id (bukan per
  // eksemplar, bukan satu IN raksasa) + insert bundel di-chunk — §10 D1.
  const consumeWrites = [];
  for (const item of kitBom) {
    const requiredTotal = neededByBook.get(item.bookId) ?? 0;
    const idsToConsume = (availableByBook.get(item.bookId) ?? []).slice(0, requiredTotal).map((c) => c.id);
    for (const ids of chunkRows(idsToConsume, D1_INLIST_CHUNK_SIZE)) {
      consumeWrites.push(
        database
          .update(bookItems)
          .set({ status: "disposed", notes: `Bundled into ${pkg.name}`, updatedAt: now })
          .where(inArray(bookItems.id, ids))
      );
    }
  }

  // Buat eksemplar fisik paket baru
  const createdPackageItems: Array<{ id: string; barcode: string }> = [];
  const itemsToInsert: Array<typeof packageItems.$inferInsert> = [];
  const timeFrag = isoTimeFragment(now, 6);

  for (let i = 0; i < quantity; i++) {
    const pItemId = newWriteId(deps);
    // Barcode mengikuti keunikan id baris: dua rakitan paket yang sama dalam
    // 1 ms tidak lagi tabrakan UNIQUE (flake #78 — timeFrag saja tidak cukup).
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
    await runWriteBatch(database, [
      ...consumeWrites,
      ...chunkRows(itemsToInsert).map((rows) => database.insert(packageItems).values(rows)),
    ]);

    // Update saldo stok kuantitas agregat (Ticket 3)
    await adjustPackageStock(database, packageId, schoolId, quantity, deps);
    for (const comp of kitBom) {
      await adjustLooseStock(database, comp.bookId, schoolId, -(comp.quantity * quantity), deps);
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
      quantityAssembled: quantity,
      assembledItems: createdPackageItems,
    },
  };
}

/**
 * Deep module: pembongkaran paket fisik (de-kitting / unbundling).
 * Menghapus bundel fisik dari package_items dan mengembalikan eksemplar satuan
 * buku komponen BOM ke stok gudang/cabang.
 */
export async function disassemblePackageBundles(
  database: AppDatabase,
  packageId: string,
  schoolId: string,
  quantity: number,
  reason: string,
  deps?: WriteDeps
): Promise<DisassembleResult> {
  const now = writeNow(deps);

  const [pkg] = await database.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return { ok: false, status: 404, message: "Package not found" };
  }

  const availableBundles = await database
    .select({ id: packageItems.id })
    .from(packageItems)
    .where(
      and(
        eq(packageItems.packageId, packageId),
        eq(packageItems.currentSchoolId, schoolId),
        inArray(packageItems.status, [...READY_BUNDLE_STATUSES])
      )
    )
    .limit(quantity);

  if (availableBundles.length < quantity) {
    return {
      ok: false,
      status: 400,
      message: `Not enough assembled packages to unbundle. Requested: ${quantity}, Available: ${availableBundles.length}`,
    };
  }

  const bom = await database
    .select({
      bookId: bookPackageItems.bookId,
      quantity: bookPackageItems.quantity,
    })
    .from(bookPackageItems)
    .where(eq(bookPackageItems.packageId, packageId));

  // Hapus paket fisik yang dibongkar bertahap + pulihkan satuan via seam §10 D1.
  const unbundleWrites = chunkRows<string>(
    availableBundles.map((b: { id: string }) => b.id),
    D1_INLIST_CHUNK_SIZE
  ).map((ids) => database.delete(packageItems).where(inArray(packageItems.id, ids)));

  // Pulihkan eksemplar satuan komponen BOM (WPR non-fisik dikecualikan).
  const restoredBookItems: Array<typeof bookItems.$inferInsert> = [];
  let totalRestoredLoose = 0;
  const timeFrag = isoTimeFragment(now, 6);

  for (const item of kitBomWithoutWpr<{ bookId: string; quantity: number }>(bom)) {
    const returnCount = item.quantity * quantity;
    for (let j = 0; j < returnCount; j++) {
      const barcode = `RET-UNB-${timeFrag}-${Math.floor(Math.random() * 1000)}`;
      restoredBookItems.push({
        id: newWriteId(deps),
        bookId: item.bookId,
        currentSchoolId: schoolId,
        barcode,
        condition: "new",
        status: "in_stock",
        notes: `Restored from unbundled package ${pkg.name}. Reason: ${reason}`,
        createdAt: now,
        updatedAt: now,
      });
      totalRestoredLoose++;
    }
  }

  if (restoredBookItems.length > 0 || unbundleWrites.length > 0) {
    try {
      await runWriteBatch(database, [
        ...unbundleWrites,
        ...chunkRows(restoredBookItems).map((rows) => database.insert(bookItems).values(rows)),
      ]);

      // Update saldo stok kuantitas agregat (Ticket 3)
      await adjustPackageStock(database, packageId, schoolId, -quantity, deps);
      for (const item of kitBomWithoutWpr<{ bookId: string; quantity: number }>(bom)) {
        await adjustLooseStock(database, item.bookId, schoolId, item.quantity * quantity, deps);
      }
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "pembongkaran paket");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }
  }

  return {
    ok: true,
    data: {
      packageId,
      unbundledCount: quantity,
      restoredLooseCount: totalRestoredLoose,
    },
  };
}
