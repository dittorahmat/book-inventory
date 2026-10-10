import type { ContentfulStatusCode } from "hono/utils/http-status";
import { isAvailableLoose, isReadyBundle, isReturnable } from "./stock-buckets";

export type FlowError = { ok: false; status: ContentfulStatusCode; message: string };

/** Status retur yang masih boleh di-resolve (satu-satunya sumber transisi, dipakai report + resolve). */
export const RETURN_OPEN_STATUSES = ["reported", "approved"] as const;
export const RETURN_TERMINAL_STATUSES = ["replaced", "rejected", "refunded"] as const;

/** Status order yang boleh dilaporkan retur: sudah serah terima (idempoten bila sudah in_progress). */
export const ORDER_REPORTABLE_STATUSES = ["picked_up", "return_in_progress"] as const;

export const isReturnOpen = (status: string): boolean =>
  (RETURN_OPEN_STATUSES as readonly string[]).includes(status);

export const isReturnTerminal = (status: string): boolean =>
  (RETURN_TERMINAL_STATUSES as readonly string[]).includes(status);

export const isOrderReportable = (status: string): boolean =>
  (ORDER_REPORTABLE_STATUSES as readonly string[]).includes(status);

export const targetReturnStatus = (action: "replace" | "reject" | "refund"): "replaced" | "rejected" | "refunded" =>
  action === "replace" ? "replaced" : action === "refund" ? "refunded" : "rejected";

/**
 * Satu-satunya mesin status resolve: terminal yang sama = idempoten ok tanpa tulis,
 * terminal berbeda atau status tak dikenal = 400. Dipakai resolveReturn dan
 * diuji langsung lewat interface modul (bukan detail implementasi).
 */
export const checkResolveTransition = (
  currentStatus: string,
  action: "replace" | "reject" | "refund"
): { ok: true; idempotent: boolean } | FlowError => {
  const target = targetReturnStatus(action);
  if (currentStatus === target) return { ok: true, idempotent: true };
  if (isReturnTerminal(currentStatus)) {
    return {
      ok: false,
      status: 400,
      message: `Laporan retur sudah berstatus ${currentStatus}, tidak dapat diproses sebagai ${target}.`,
    };
  }
  if (!isReturnOpen(currentStatus)) {
    return {
      ok: false,
      status: 400,
      message: `Laporan retur berstatus ${currentStatus}, hanya ${[...RETURN_OPEN_STATUSES].join("/")} yang dapat diproses.`,
    };
  }
  return { ok: true, idempotent: false };
};

export interface BundleRow {
  id: string;
  packageId: string;
  currentSchoolId: string | null;
  barcode: string | null;
  status: string;
}

export interface OrderRef {
  schoolId: string;
  packageId: string | null;
}

/**
 * Guard ketersediaan bundel serah terima: satu paket pesanan, satu cabang,
 * status ready via seam stock-buckets. Menutup jalur ID eksplisit yang
 * mencuri bundel cabang lain / berstatus reserved/dispatched/delivered.
 */
export const checkHandoverBundle = (bundle: BundleRow, order: OrderRef): FlowError | null => {
  if (order.packageId && bundle.packageId !== order.packageId) {
    return {
      ok: false,
      status: 400,
      message: `Bundel ${bundle.barcode || bundle.id} tidak termasuk paket pesanan ini.`,
    };
  }
  if (bundle.currentSchoolId !== order.schoolId) {
    return {
      ok: false,
      status: 400,
      message: `Bundel ${bundle.barcode || bundle.id} tidak tersedia di cabang ini untuk diserahkan.`,
    };
  }
  if (!isReadyBundle(bundle.status)) {
    return {
      ok: false,
      status: 400,
      message: `Bundel ${bundle.barcode || bundle.id} berstatus ${bundle.status}, tidak dapat diserahkan.`,
    };
  }
  return null;
};

export interface LooseRow {
  id: string;
  bookId: string;
  currentSchoolId: string | null;
  barcode: string | null;
  condition: string;
  status: string;
}

/** Guard pengganti retur: judul sama, satu cabang, tersedia + kondisi baru via seam stock-buckets. */
export const checkReplacementLoose = (
  item: LooseRow,
  order: OrderRef,
  defectiveBookId: string
): FlowError | null => {
  if (item.bookId !== defectiveBookId) {
    return {
      ok: false,
      status: 400,
      message: `Pengganti ${item.barcode || item.id} bukan judul buku yang dilaporkan rusak.`,
    };
  }
  if (item.currentSchoolId !== order.schoolId) {
    return {
      ok: false,
      status: 400,
      message: `Pengganti ${item.barcode || item.id} tidak tersedia di cabang pesanan ini.`,
    };
  }
  if (!isAvailableLoose(item.status)) {
    return {
      ok: false,
      status: 400,
      message: `Pengganti ${item.barcode || item.id} berstatus ${item.status}, tidak dapat dipakai.`,
    };
  }
  if (!isReturnable(item.condition)) {
    return {
      ok: false,
      status: 400,
      message: `Pengganti ${item.barcode || item.id} berkondisi ${item.condition}, hanya kondisi baru yang layak.`,
    };
  }
  return null;
};
