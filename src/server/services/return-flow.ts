import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { bookItems } from "../../db/schema";
import { writeNow, newWriteId, type WriteDeps } from "../lib/d1-write";
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
): FlowError | null => {  if (item.bookId !== defectiveBookId) {
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

export interface ReturnResolveFacts {
  action: "replace" | "reject" | "refund";
  returnId: string;
  defectiveBookId: string;
  /** Dibangun dari baris order milik retur — caller dilarang merakit sendiri. */
  order: OrderRef;
  /** Masih ada laporan terbuka lain untuk order yang sama? */
  siblingOpen: boolean;
  /** Kandidat pengganti yang sudah lolos guard (eksplisit atau auto-pick), atau null. */
  replacementId: string | null;
  refundAmount?: number;
  handledByUserId?: string;
}

export interface PlannedReturnResolve {
  orderStatusAfter: "return_in_progress" | "picked_up";
  returnStatus: "replaced" | "rejected" | "refunded";
  replacementBookItemId: string | null;
  refundAmount: number;
  disposeReplacementId: string | null;
  restoredStockRow: typeof bookItems.$inferInsert | null;
}

/**
 * Perencana murni penyelesaian retur (cermin planPoReceive): dari fakta
 * yang sudah divalidasi susun status order sesudahnya + patch retur +
 * efek samping (flip pengganti / baris stok RFD). Tanpa DB, deterministik
 * via deps — caller hanya mengeksekusi satu batch.
 */
export const planReturnResolve = (facts: ReturnResolveFacts, deps?: WriteDeps): PlannedReturnResolve => {
  const now = writeNow(deps);
  const orderStatusAfter = facts.siblingOpen ? "return_in_progress" : "picked_up";
  if (facts.action === "replace") {
    return {
      orderStatusAfter,
      returnStatus: "replaced",
      replacementBookItemId: facts.replacementId,
      refundAmount: 0,
      disposeReplacementId: facts.replacementId,
      restoredStockRow: null,
    };
  }
  if (facts.action === "refund") {
    const bookItemId = newWriteId(deps);
    const epoch = String(Date.parse(now) % 1000000).padStart(6, "0");
    const suffix = bookItemId.replace(/-/g, "").slice(0, 3).toUpperCase().padEnd(3, "0");
    return {
      orderStatusAfter,
      returnStatus: "refunded",
      replacementBookItemId: null,
      refundAmount: facts.refundAmount ?? 0,
      disposeReplacementId: null,
      restoredStockRow: {
        id: bookItemId,
        bookId: facts.defectiveBookId,
        currentSchoolId: facts.order.schoolId,
        barcode: `RFD-${epoch}-${suffix}`,
        condition: "good",
        status: "in_stock",
        notes: `Restored to stock from parent refund (Return #${facts.returnId})`,
        createdAt: now,
        updatedAt: now,
      },
    };
  }
  return {
    orderStatusAfter,
    returnStatus: "rejected",
    replacementBookItemId: null,
    refundAmount: 0,
    disposeReplacementId: null,
    restoredStockRow: null,
  };
};
