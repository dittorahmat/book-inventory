import { and, count, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import { bookItems, packageItems } from "../../../db/schema";
import {
  ALLOCATABLE_CONDITIONS,
  AVAILABLE_LOOSE_STATUSES,
  READY_BUNDLE_STATUSES,
  type AllocatableCondition,
} from "./buckets";

export type AllocationError = { ok: false; status: ContentfulStatusCode; message: string; available?: number; needed?: number };
export type AllocationResult<T> = { ok: true; items: T[] } | AllocationError;

interface LooseCandidate {
  id: string;
  barcode: string;
  condition: string;
  status: string;
}

interface PackageCandidate {
  id: string;
  barcode: string;
  packageId: string;
  status: string;
}

export interface AllocatedItem {
  id: string;
  barcode: string;
  kind: "loose" | "package";
  condition?: string;
  packageId?: string;
}

export type InventoryAllocationInput =
  | {
      kind: "loose";
      targetId: string; // bookId
      schoolId: string;
      quantity: number;
      conditions?: readonly AllocatableCondition[];
    }
  | {
      kind: "package";
      targetId: string; // packageId
      schoolId: string;
      quantity: number;
    };

/**
 * Seam terpadu alokasi FIFO inventaris fisik (satuan atau paket).
 * Mengabstraksi pemilihan tabel, kueri count kekurangan stok, dan format hasil.
 */
export async function allocateInventoryStock(
  input: InventoryAllocationInput,
  database: AppDatabase
): Promise<AllocationResult<AllocatedItem>> {
  if (input.kind === "loose") {
    const res = await allocateLooseStock(
      {
        bookId: input.targetId,
        schoolId: input.schoolId,
        quantity: input.quantity,
        conditions: input.conditions,
      },
      database
    );
    if (!res.ok) return res;
    return {
      ok: true,
      items: res.items.map((i) => ({
        id: i.id,
        barcode: i.barcode,
        kind: "loose",
        condition: i.condition,
      })),
    };
  }

  const res = await allocatePackages(
    {
      packageId: input.targetId,
      schoolId: input.schoolId,
      quantity: input.quantity,
    },
    database
  );
  if (!res.ok) return res;
  return {
    ok: true,
    items: res.items.map((i) => ({
      id: i.id,
      barcode: i.barcode,
      kind: "package",
      packageId: i.packageId,
    })),
  };
}

/**
 * Alokasi FIFO eksemplar satuan: pilih N eksemplar tertua yang tersedia
 * di lokasi asal tanpa pengguna memilih barcode (spec: inventory-summary).
 * FIFO + batas di SQL (ORDER BY/LIMIT): hanya N baris yang ditransfer,
 * bukan seluruh stok lalu di-sort di JS. Hitungan total hanya di-query
 * saat stok kurang (untuk pesan error yang tepat).
 */
export async function allocateLooseStock(
  input: {
    bookId: string;
    schoolId: string;
    quantity: number;
    conditions?: readonly AllocatableCondition[];
  },
  database: AppDatabase
): Promise<AllocationResult<{ id: string; barcode: string; condition: string }>> {
  const conditions = input.conditions ?? ALLOCATABLE_CONDITIONS;
  const filters = and(
    eq(bookItems.bookId, input.bookId),
    eq(bookItems.currentSchoolId, input.schoolId),
    inArray(bookItems.status, [...AVAILABLE_LOOSE_STATUSES]),
    inArray(bookItems.condition, [...conditions])
  );
  const candidates: LooseCandidate[] = await database
    .select({
      id: bookItems.id,
      barcode: bookItems.barcode,
      condition: bookItems.condition,
      status: bookItems.status,
    })
    .from(bookItems)
    .where(filters)
    .orderBy(bookItems.createdAt)
    .limit(input.quantity);

  if (candidates.length < input.quantity) {
    const [{ total }] = await database
      .select({ total: count() })
      .from(bookItems)
      .where(filters);
    return {
      ok: false,
      status: 400,
      message: `Stok tidak cukup. Dibutuhkan ${input.quantity} eksemplar, tersedia ${total}.`,
      available: total,
      needed: input.quantity,
    };
  }

  return {
    ok: true,
    items: candidates.map((r) => ({
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
  database: AppDatabase
): Promise<AllocationResult<{ id: string; barcode: string; packageId: string }>> {
  const filters = and(
    eq(packageItems.packageId, input.packageId),
    eq(packageItems.currentSchoolId, input.schoolId),
    inArray(packageItems.status, [...READY_BUNDLE_STATUSES])
  );
  const candidates: PackageCandidate[] = await database
    .select({
      id: packageItems.id,
      barcode: packageItems.barcode,
      packageId: packageItems.packageId,
      status: packageItems.status,
    })
    .from(packageItems)
    .where(filters)
    .orderBy(packageItems.createdAt)
    .limit(input.quantity);

  if (candidates.length < input.quantity) {
    const [{ total }] = await database
      .select({ total: count() })
      .from(packageItems)
      .where(filters);
    return {
      ok: false,
      status: 400,
      message: `Bundel paket tidak cukup. Dibutuhkan ${input.quantity}, tersedia ${total}.`,
      available: total,
      needed: input.quantity,
    };
  }

  return {
    ok: true,
    items: candidates.map((r) => ({
      id: r.id,
      barcode: r.barcode,
      packageId: r.packageId,
    })),
  };
}
