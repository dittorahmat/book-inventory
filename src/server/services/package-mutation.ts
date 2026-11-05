import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookPackageItems, bookPackageSchools, bookPackages, packageItems, studentBookOrders } from "../../db/schema";
import { chunkRows, d1WriteErrorStatus, newWriteId, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { recalcPackagePrice } from "./pricing";
import { READY_BUNDLE_STATUSES } from "./stock";
import { ensurePackageHasWpr } from "./wpr";
import { disassemblePackageBundles, type AssemblyError } from "./package-assembly";

export type DeletePackageResult =
  | {
      ok: true;
      data: {
        packageId: string;
        unbundledCount: number;
        restoredLooseCount: number;
      };
    }
  | AssemblyError;

export type UnbundleAllResult =
  | {
      ok: true;
      data: {
        packageId: string;
        unbundledCount: number;
        restoredLooseCount: number;
      };
    }
  | AssemblyError;

export type UpdatePackagePayload = {
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  description?: string | null;
  schoolIds?: string[];
  items: Array<{ bookId: string; quantity: number }>;
};

export type UpdatePackageResult =
  | {
      ok: true;
      data: typeof bookPackages.$inferSelect & { price: number };
      unbundledCount: number;
    }
  | AssemblyError;

/**
 * Bongkar seluruh bundel ready dari satu paket di seluruh sekolah/gudang.
 * Digunakan sebelum penghapusan atau sebelum perubahan komposisi BOM paket.
 */
export async function unbundleAllActiveBundles(
  database: AppDatabase,
  packageId: string,
  reason: string,
  deps?: WriteDeps
): Promise<UnbundleAllResult> {
  const activeBundles = await database
    .select({ id: packageItems.id, schoolId: packageItems.currentSchoolId })
    .from(packageItems)
    .where(and(eq(packageItems.packageId, packageId), inArray(packageItems.status, [...READY_BUNDLE_STATUSES])));

  const bySchool = new Map<string, number>();
  for (const b of activeBundles) {
    bySchool.set(b.schoolId, (bySchool.get(b.schoolId) ?? 0) + 1);
  }

  let totalUnbundled = 0;
  let totalRestored = 0;
  for (const [schoolId, count] of bySchool.entries()) {
    const res = await disassemblePackageBundles(database, packageId, schoolId, count, reason, deps);
    if (!res.ok) return res;
    totalUnbundled += res.data.unbundledCount;
    totalRestored += res.data.restoredLooseCount;
  }

  return {
    ok: true,
    data: {
      packageId,
      unbundledCount: totalUnbundled,
      restoredLooseCount: totalRestored,
    },
  };
}

/**
 * Hapus master paket dengan aman:
 * 1. Bongkar seluruh bundel fisik ready di semua cabang (mengembalikan eksemplar ke stok satuan).
 * 2. Hapus seluruh relasi BOM (book_package_items).
 * 3. Hapus entitas master book_packages.
 */
export async function deletePackageWithAutoUnbundle(
  database: AppDatabase,
  packageId: string,
  deps?: WriteDeps
): Promise<DeletePackageResult> {
  const [pkg] = await database.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!pkg) {
    return { ok: false, status: 404, message: "Package not found" };
  }

  // Guard riwayat pesanan siswa
  const existingOrders = await database
    .select({ orderNumber: studentBookOrders.orderNumber })
    .from(studentBookOrders)
    .where(eq(studentBookOrders.packageId, packageId))
    .limit(5);

  if (existingOrders.length > 0) {
    const list = existingOrders.map((o: { orderNumber: string }) => `#${o.orderNumber}`).join(", ");
    return {
      ok: false,
      status: 400,
      message: `Paket "${pkg.name}" tidak dapat dihapus karena tercatat dalam pesanan siswa (${list}).`,
    };
  }

  // Guard fisik paket yang pernah didistribusikan / bukan status ready unbundle
  const nonReadyItems = await database
    .select({ barcode: packageItems.barcode, status: packageItems.status })
    .from(packageItems)
    .where(and(eq(packageItems.packageId, packageId), sql`${packageItems.status} NOT IN ('in_stock', 'reserved')`))
    .limit(5);

  if (nonReadyItems.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `Paket "${pkg.name}" tidak dapat dihapus karena memiliki riwayat bundel fisik terdistribusi (misal barcode ${nonReadyItems[0].barcode} status ${nonReadyItems[0].status}).`,
    };
  }

  const unbundleRes = await unbundleAllActiveBundles(database, packageId, `Auto-unbundle saat penghapusan paket ${pkg.name}`, deps);
  if (!unbundleRes.ok) return unbundleRes;

  try {
    await runWriteBatch(database, [
      database.delete(bookPackageSchools).where(eq(bookPackageSchools.packageId, packageId)),
      database.delete(bookPackageItems).where(eq(bookPackageItems.packageId, packageId)),
      database.delete(bookPackages).where(eq(bookPackages.id, packageId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penghapusan paket");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    data: {
      packageId,
      unbundledCount: unbundleRes.data.unbundledCount,
      restoredLooseCount: unbundleRes.data.restoredLooseCount,
    },
  };
}

/**
 * Deep module: perbarui metadata & komposisi BOM paket dengan auto-unbundle atomik.
 */
export async function updatePackageWithAutoUnbundle(
  database: AppDatabase,
  packageId: string,
  payload: UpdatePackagePayload,
  deps?: WriteDeps
): Promise<UpdatePackageResult> {
  const [existing] = await database.select().from(bookPackages).where(eq(bookPackages.id, packageId));
  if (!existing) {
    return { ok: false, status: 404, message: "Package not found" };
  }

  if (payload.code !== existing.code) {
    const [dup] = await database.select().from(bookPackages).where(eq(bookPackages.code, payload.code));
    if (dup) {
      return { ok: false, status: 400, message: "Package code already exists" };
    }
  }

  // 1. Auto-unbundle bundel fisik aktif di seluruh cabang/gudang
  const unbundleRes = await unbundleAllActiveBundles(database, packageId, `Auto-unbundle saat edit paket ${existing.name}`, deps);
  if (!unbundleRes.ok) return unbundleRes;

  const now = writeNow(deps);

  // 2. Persiapkan baris BOM baru
  const bomRows = payload.items.map((it) => ({
    id: newWriteId(deps),
    packageId,
    bookId: it.bookId,
    quantity: it.quantity,
    createdAt: now,
  }));

  // 3. Eksekusi update metadata & pergantian BOM
  try {
    const updateHeader = database
      .update(bookPackages)
      .set({
        code: payload.code,
        name: payload.name,
        gradeLevel: payload.gradeLevel,
        curriculumType: payload.curriculumType,
        academicYear: payload.academicYear,
        description: payload.description ?? null,
        updatedAt: now,
      })
      .where(eq(bookPackages.id, packageId));

    const deleteOldBom = database.delete(bookPackageItems).where(eq(bookPackageItems.packageId, packageId));
    const deleteOldSchools = database.delete(bookPackageSchools).where(eq(bookPackageSchools.packageId, packageId));

    await runWriteBatch(database, [updateHeader, deleteOldBom, deleteOldSchools]);

    for (const rows of chunkRows(bomRows)) {
      await runWriteBatch(database, [database.insert(bookPackageItems).values(rows)]);
    }

    if (payload.schoolIds && payload.schoolIds.length > 0) {
      const schoolRows = [...new Set(payload.schoolIds)].map((schoolId) => ({
        packageId,
        schoolId,
        createdAt: now,
      }));
      for (const rows of chunkRows(schoolRows)) {
        await runWriteBatch(database, [database.insert(bookPackageSchools).values(rows)]);
      }
    }

    // WPR wajib di semua BOM paket
    await ensurePackageHasWpr(database, packageId, deps);

    // Hitung ulang harga paket
    const computedTotal = await recalcPackagePrice(database, packageId, deps);

    const [updated] = await database.select().from(bookPackages).where(eq(bookPackages.id, packageId));
    return {
      ok: true,
      data: updated ? { ...updated, price: computedTotal } : ({ ...existing, price: computedTotal }),
      unbundledCount: unbundleRes.data.unbundledCount,
    };
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "memperbarui paket");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
}
