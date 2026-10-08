/**
 * Satu-satunya pemilik definisi bucket status stok: himpunan status yang
 * berarti tersedia/transit/hilang/siap, predikat baris, dan matematika
 * piutang. Dipakai agregasi stok per judul, potensi paket, dan ringkasan
 * dasbor agar perubahan status hanya diaudit di satu modul.
 */

export const AVAILABLE_LOOSE_STATUSES = ["in_stock"] as const;
export const LOOSE_IN_TRANSIT_STATUSES = ["in_transit"] as const;
export const LOST_STATUSES = ["lost"] as const;
export const DISPOSED_STATUSES = ["disposed"] as const;
export const READY_BUNDLE_STATUSES = ["in_stock"] as const;
export const OPEN_ORDER_PAYMENT_STATUSES = ["unpaid", "partial"] as const;

/** Kondisi layak alokasi otomatis untuk serah terima (design D5). */
export const ALLOCATABLE_CONDITIONS = ["new", "good"] as const;
export type AllocatableCondition = (typeof ALLOCATABLE_CONDITIONS)[number];

/** Kondisi layak rakit ke paket (kitting hanya menyerap eksemplar baru). */
export const KITTABLE_CONDITIONS = ["new"] as const;
export type KittableCondition = (typeof KITTABLE_CONDITIONS)[number];

/** Kondisi layak pengganti retur (hanya eksemplar baru). */
export const RETURNABLE_CONDITIONS = ["new"] as const;
export type ReturnableCondition = (typeof RETURNABLE_CONDITIONS)[number];

/** Kondisi rusak untuk aturan attention dasbor/kernel. */
export const DAMAGED_CONDITIONS = ["damaged"] as const;

export const isAllocatable = (condition: string): boolean =>
  (ALLOCATABLE_CONDITIONS as readonly string[]).includes(condition);

export const isKittable = (condition: string): boolean =>
  (KITTABLE_CONDITIONS as readonly string[]).includes(condition);

export const isReturnable = (condition: string): boolean =>
  (RETURNABLE_CONDITIONS as readonly string[]).includes(condition);

export const isDamaged = (condition: string): boolean =>
  (DAMAGED_CONDITIONS as readonly string[]).includes(condition);

export const isDisposed = (status: string): boolean =>
  (DISPOSED_STATUSES as readonly string[]).includes(status);

export const isAvailableLoose = (status: string): boolean =>
  (AVAILABLE_LOOSE_STATUSES as readonly string[]).includes(status);

export const isLooseInTransit = (status: string): boolean =>
  (LOOSE_IN_TRANSIT_STATUSES as readonly string[]).includes(status);

export const isLost = (status: string): boolean =>
  (LOST_STATUSES as readonly string[]).includes(status);

export const isReadyBundle = (status: string): boolean =>
  (READY_BUNDLE_STATUSES as readonly string[]).includes(status);

export const isOpenOrder = (paymentStatus: string): boolean =>
  (OPEN_ORDER_PAYMENT_STATUSES as readonly string[]).includes(paymentStatus);

/** Sisa tagihan satu order: total − terbayar, tidak pernah negatif. */
export const outstandingOf = (order: { totalAmount: number; paidAmount: number }): number =>
  Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));

export const emptyConditionBuckets = () => ({ new: 0, good: 0, fair: 0, damaged: 0 });

export const emptyLooseStatusBuckets = () => ({ in_stock: 0, in_transit: 0, disposed: 0, lost: 0 });

export const emptyPackageStatusBuckets = () => ({ in_stock: 0, reserved: 0, dispatched: 0, delivered: 0 });
