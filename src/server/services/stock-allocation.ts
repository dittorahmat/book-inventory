import { and, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { db, type AppDatabase } from "../../db";
import { bookItems, packageItems } from "../../db/schema";
import {
  ALLOCATABLE_CONDITIONS,
  AVAILABLE_LOOSE_STATUSES,
  READY_BUNDLE_STATUSES,
  type AllocatableCondition,
} from "./stock-buckets";

/** Re-ekspor seam kondisi agar satu perubahan status menyentuh satu modul. */
export { ALLOCATABLE_CONDITIONS, type AllocatableCondition };

export type AllocationError = { ok: false; status: ContentfulStatusCode; message: string };
export type AllocationResult<T> = { ok: true; items: T[] } | AllocationError;

interface LooseCandidate {
  id: string;
  barcode: string;
  condition: string;
  status: string;
  createdAt: string;
}

interface PackageCandidate {
  id: string;
  barcode: string;
  packageId: string;
  status: string;
  createdAt: string;
}

/** Urut FIFO: createdAt terlama lebih dulu. */
const byOldest = (a: { createdAt: string }, b: { createdAt: string }): number => a.createdAt.localeCompare(b.createdAt);

/**
 * Alokasi FIFO eksemplar satuan: pilih N eksemplar tertua yang tersedia
 * di lokasi asal tanpa pengguna memilih barcode (spec: inventory-summary).
 */
export async function allocateLooseStock(
  input: {
    bookId: string;
    schoolId: string;
    quantity: number;
    conditions?: readonly AllocatableCondition[];
  },
  database: AppDatabase = db
): Promise<AllocationResult<{ id: string; barcode: string; condition: string }>> {
  const conditions = input.conditions ?? ALLOCATABLE_CONDITIONS;
  const candidates: LooseCandidate[] = await database
    .select({
      id: bookItems.id,
      barcode: bookItems.barcode,
      condition: bookItems.condition,
      status: bookItems.status,
      createdAt: bookItems.createdAt,
    })
    .from(bookItems)
    .where(
      and(
        eq(bookItems.bookId, input.bookId),
        eq(bookItems.currentSchoolId, input.schoolId),
        inArray(bookItems.status, [...AVAILABLE_LOOSE_STATUSES]),
        inArray(bookItems.condition, [...conditions])
      )
    );

  const ordered = candidates.sort(byOldest);
  if (ordered.length < input.quantity) {
    return {
      ok: false,
      status: 400,
      message: `Stok tidak cukup. Dibutuhkan ${input.quantity} eksemplar, tersedia ${ordered.length}.`,
    };
  }

  return {
    ok: true,
    items: ordered.slice(0, input.quantity).map((r) => ({
      id: r.id,
      barcode: r.barcode,
      condition: r.condition,
    })),
  };
}

/** Alokasi FIFO bundel fisik untuk satu jenis paket di lokasi asal. */
export async function allocatePackages(
  input: {
    packageId: string;
    schoolId: string;
    quantity: number;
  },
  database: AppDatabase = db
): Promise<AllocationResult<{ id: string; barcode: string; packageId: string }>> {
  const candidates: PackageCandidate[] = await database
    .select({
      id: packageItems.id,
      barcode: packageItems.barcode,
      packageId: packageItems.packageId,
      status: packageItems.status,
      createdAt: packageItems.createdAt,
    })
    .from(packageItems)
    .where(
      and(
        eq(packageItems.packageId, input.packageId),
        eq(packageItems.currentSchoolId, input.schoolId),
        inArray(packageItems.status, [...READY_BUNDLE_STATUSES])
      )
    );

  const ordered = candidates.sort(byOldest);
  if (ordered.length < input.quantity) {
    return {
      ok: false,
      status: 400,
      message: `Bundel paket tidak cukup. Dibutuhkan ${input.quantity}, tersedia ${ordered.length}.`,
    };
  }

  return {
    ok: true,
    items: ordered.slice(0, input.quantity).map((r) => ({
      id: r.id,
      barcode: r.barcode,
      packageId: r.packageId,
    })),
  };
}

export interface ShipmentLineInput {
  itemType: "loose" | "package";
  bookId?: string;
  packageId?: string;
  quantity: number;
}

export type ResolvedShipmentLines =
  | { ok: true; looseIds: string[]; bundleIds: string[] }
  | AllocationError;

/**
 * Ubah input kuantitas per judul/paket menjadi daftar eksemplar fisik konkret
 * (FIFO), sehingga satu surat jalan dapat memuat banyak jenis paket sekaligus.
 */
export async function resolveShipmentLines(
  fromSchoolId: string,
  lines: ShipmentLineInput[],
  database: AppDatabase = db
): Promise<ResolvedShipmentLines> {
  const looseIds: string[] = [];
  const bundleIds: string[] = [];

  for (const line of lines) {
    if (line.itemType === "loose") {
      if (!line.bookId) {
        return { ok: false, status: 400, message: "Baris buku satuan harus menyertakan bookId." };
      }
      const result = await allocateLooseStock(
        {
          bookId: line.bookId,
          schoolId: fromSchoolId,
          quantity: line.quantity,
        },
        database
      );
      if (!result.ok) return result;
      looseIds.push(...result.items.map((i) => i.id));
      continue;
    }

    if (!line.packageId) {
      return { ok: false, status: 400, message: "Baris paket harus menyertakan packageId." };
    }
    const result = await allocatePackages(
      {
        packageId: line.packageId,
        schoolId: fromSchoolId,
        quantity: line.quantity,
      },
      database
    );
    if (!result.ok) return result;
    bundleIds.push(...result.items.map((i) => i.id));
  }

  return { ok: true, looseIds, bundleIds };
}
