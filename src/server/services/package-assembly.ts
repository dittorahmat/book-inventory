import { and, eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { db } from "../../db";
import { bookPackages, bookPackageItems, packageItems, books, bookItems } from "../../db/schema";

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
  packageId: string,
  schoolId: string,
  quantity: number
): Promise<AssembleResult> {
  const now = new Date().toISOString();

  const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return { ok: false, status: 404, message: "Package not found" };
  }

  const bom = await db
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

  // Verifikasi kecukupan stok semua komponen
  for (const item of bom) {
    const requiredTotal = item.quantity * quantity;
    const loose = await db
      .select({ id: bookItems.id })
      .from(bookItems)
      .where(
        and(
          eq(bookItems.bookId, item.bookId),
          eq(bookItems.currentSchoolId, schoolId),
          eq(bookItems.status, "in_stock"),
          eq(bookItems.condition, "new")
        )
      );

    if (loose.length < requiredTotal) {
      return {
        ok: false,
        status: 400,
        message: `Insufficient stock for "${item.title}". Required: ${requiredTotal}, Available: ${loose.length}`,
      };
    }
  }

  // Potong stok satuan & tandai diserap ke paket
  for (const item of bom) {
    const requiredTotal = item.quantity * quantity;
    const looseToConsume = await db
      .select({ id: bookItems.id })
      .from(bookItems)
      .where(
        and(
          eq(bookItems.bookId, item.bookId),
          eq(bookItems.currentSchoolId, schoolId),
          eq(bookItems.status, "in_stock"),
          eq(bookItems.condition, "new")
        )
      )
      .limit(requiredTotal);

    for (const l of looseToConsume) {
      await db
        .update(bookItems)
        .set({ status: "disposed", notes: `Bundled into ${pkg.name}`, updatedAt: now })
        .where(eq(bookItems.id, l.id));
    }
  }

  // Buat eksemplar fisik paket baru
  const createdPackageItems: Array<{ id: string; barcode: string }> = [];
  const itemsToInsert: Array<typeof packageItems.$inferInsert> = [];

  for (let i = 0; i < quantity; i++) {
    const itemBarcode = `PKG-${pkg.code}-${Date.now().toString().slice(-6)}-${(i + 1).toString().padStart(3, "0")}`;
    const pItemId = crypto.randomUUID();
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

  if (itemsToInsert.length > 0) {
    await db.insert(packageItems).values(itemsToInsert);
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
  packageId: string,
  schoolId: string,
  quantity: number,
  reason: string
): Promise<DisassembleResult> {
  const now = new Date().toISOString();

  const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return { ok: false, status: 404, message: "Package not found" };
  }

  const availableBundles = await db
    .select({ id: packageItems.id })
    .from(packageItems)
    .where(
      and(
        eq(packageItems.packageId, packageId),
        eq(packageItems.currentSchoolId, schoolId),
        eq(packageItems.status, "in_stock")
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

  const bom = await db
    .select({
      bookId: bookPackageItems.bookId,
      quantity: bookPackageItems.quantity,
    })
    .from(bookPackageItems)
    .where(eq(bookPackageItems.packageId, packageId));

  // Hapus paket fisik yang dibongkar
  for (const b of availableBundles) {
    await db.delete(packageItems).where(eq(packageItems.id, b.id));
  }

  // Pulihkan eksemplar satuan komponen BOM
  const restoredBookItems: Array<typeof bookItems.$inferInsert> = [];
  let totalRestoredLoose = 0;

  for (const item of bom) {
    const returnCount = item.quantity * quantity;
    for (let j = 0; j < returnCount; j++) {
      const barcode = `RET-UNB-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
      restoredBookItems.push({
        id: crypto.randomUUID(),
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

  if (restoredBookItems.length > 0) {
    await db.insert(bookItems).values(restoredBookItems);
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
