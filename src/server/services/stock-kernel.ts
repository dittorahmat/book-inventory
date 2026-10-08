import {
  emptyConditionBuckets,
  emptyLooseStatusBuckets,
  emptyPackageStatusBuckets,
  isAvailableLoose,
  isLooseInTransit,
  isLost,
  isReadyBundle,
} from "./stock-buckets";

/**
 * Kernel agregasi stok fisik: satu-satunya pemilik aturan menghitung.
 * Ringkasan inventory, dasbor, dan potensi paket adalah adapter tipis
 * di atas seam ini — perubahan status hanya diaudit di sini.
 * Modul ini murni (tanpa DB) agar bisa di-unit-test langsung.
 */

export interface LooseCountRow {
  status: string;
  condition: string;
}

export interface LooseTally {
  totalQty: number;
  availableQty: number;
  inTransitQty: number;
  lostQty: number;
  /** Kondisi rusak yang masih tersedia (aturan attention dasbor). */
  damagedQty: number;
  /** Per kondisi, hanya baris tersedia (aturan dasbor). */
  byConditionAvailable: { new: number; good: number; fair: number; damaged: number };
  /** Per kondisi, semua baris (aturan inventory). */
  byConditionAll: { new: number; good: number; fair: number; damaged: number };
  byStatus: { in_stock: number; in_transit: number; disposed: number; lost: number };
}

export interface PackageCountRow {
  status: string;
}

export interface PackageTally {
  totalQty: number;
  readyQty: number;
  byStatus: { in_stock: number; reserved: number; dispatched: number; delivered: number };
}

export const newLooseTally = (): LooseTally => ({
  totalQty: 0,
  availableQty: 0,
  inTransitQty: 0,
  lostQty: 0,
  damagedQty: 0,
  byConditionAvailable: emptyConditionBuckets(),
  byConditionAll: emptyConditionBuckets(),
  byStatus: emptyLooseStatusBuckets(),
});

export const newPackageTally = (): PackageTally => ({
  totalQty: 0,
  readyQty: 0,
  byStatus: emptyPackageStatusBuckets(),
});

const bump = (buckets: Record<string, number>, key: string): void => {
  if (key in buckets) buckets[key] += 1;
};

/** Hitung satu eksemplar satuan ke dalam tally (idempoten per baris). */
export function addLoose(tally: LooseTally, row: LooseCountRow): void {
  tally.totalQty += 1;
  bump(tally.byStatus, row.status);
  bump(tally.byConditionAll, row.condition);
  if (isAvailableLoose(row.status)) {
    tally.availableQty += 1;
    bump(tally.byConditionAvailable, row.condition);
    if (row.condition === "damaged") tally.damagedQty += 1;
  }
  if (isLooseInTransit(row.status)) tally.inTransitQty += 1;
  if (isLost(row.status)) tally.lostQty += 1;
}

/** Hitung satu bundel fisik ke dalam tally. */
export function addPackage(tally: PackageTally, row: PackageCountRow): void {
  tally.totalQty += 1;
  bump(tally.byStatus, row.status);
  if (isReadyBundle(row.status)) tally.readyQty += 1;
}

/** Tally satu grup baris satuan (kosong -> semua nol). */
export const tallyLoose = (rows: LooseCountRow[]): LooseTally => {
  const tally = newLooseTally();
  rows.forEach((row) => addLoose(tally, row));
  return tally;
};

/** Tally satu grup baris bundel (kosong -> semua nol). */
export const tallyPackages = (rows: PackageCountRow[]): PackageTally => {
  const tally = newPackageTally();
  rows.forEach((row) => addPackage(tally, row));
  return tally;
};
