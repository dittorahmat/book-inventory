/**
 * Satu-satunya adapter tipis portal publik di atas fetch kanonik (`lib/api`).
 * Modul ini dilarang menyimpan state, menghitung total, atau merakit payload —
 * hanya pemetaan endpoint → getJson/postJson dengan pesan error Bahasa Indonesia.
 * Total optimistik tinggal di `lib/book-pricing` + `lib/transfer-pricing`,
 * resolusi paket di `lib/resolve-package`, perakitan payload di `order-payload`.
 */
import { ApiError, buildQuery, getJson, postJson } from "../../lib/api";
import type {
  SchoolOption,
  StudentSearchResult,
  BookPackageOption,
  NewStudentForm,
  SatuanStatus,
  PortalOrderLookup,
  PortalBookChoice,
} from "../../lib/portal-types";
import type {
  UniformCatalog,
  SubmitUniformOrderPayload,
  UniformStudent,
} from "../../lib/uniform-types";

export const fetchSchools = (): Promise<SchoolOption[]> =>
  getJson<SchoolOption[]>("/api/public/orders/schools", "Gagal memuat daftar sekolah.");

/** Ukur latensi yang dirasakan ortu; hanya tampil di dev (nol overhead produksi). */
const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    if (import.meta.env.DEV) console.debug(`[portal-timing] ${label}: ${Math.round(performance.now() - t0)}ms`);
  }
};

export const fetchPackages = (): Promise<BookPackageOption[]> =>
  getJson<BookPackageOption[]>("/api/public/orders/packages", "Gagal memuat daftar paket buku.");

export interface StudentSearchParams {
  query: string;
  schoolId: string;
}

export const searchStudents = (
  paramsOrQuery: StudentSearchParams | string,
  legacySchoolId?: string
): Promise<StudentSearchResult[]> => {
  const params: StudentSearchParams =
    typeof paramsOrQuery === "string"
      ? { query: paramsOrQuery, schoolId: legacySchoolId ?? "" }
      : paramsOrQuery;

  return timed("search-students", () =>
    getJson<StudentSearchResult[]>(
      buildQuery("/api/public/orders/search-students", {
        query: params.query.trim(),
        schoolId: params.schoolId,
      }),
      "Gagal melakukan pencarian siswa."
    )
  );
};

export const registerStudent = (payload: NewStudentForm): Promise<any> =>
  postJson("/api/public/orders/register-student", payload, "Gagal mendaftarkan siswa baru");

export interface FinalOrderPayload {
  studentId: string;
  packageId?: string;
  replacePendingOrderId?: string;
  looseItems?: Array<{ bookId: string; quantity: number }>;
  homeAddress?: string;
  orderType: "regular" | "scholarship";
  scholarshipProofBase64?: string;
  financeProofBase64?: string;
  parentPhoneManual?: string;
  payment?: {
    transferAmount: number;
    bookAllocationAmount: number;
    bankName?: string;
    referenceNumber?: string;
    paymentProofBase64?: string;
  };
  notes?: string;
}

export interface SatuanBookOption {
  id: string;
  title: string;
  sellPrice: number;
  price?: number | null;
}

/** Katalog satuan; kosong saat periode tertutup. Dapat difilter sesuai jenjang & sekolah murid. */
export const fetchSatuanCatalog = (params?: {
  schoolId?: string;
  gradeLevel?: string;
  academicYear?: string;
}): Promise<{ open: boolean; status: SatuanStatus; books: SatuanBookOption[] }> =>
  getJson(
    buildQuery("/api/public/orders/satuan-catalog", {
      schoolId: params?.schoolId,
      gradeLevel: params?.gradeLevel,
      academicYear: params?.academicYear,
    }),
    "Gagal memuat daftar buku satuan"
  );

export const submitFinalOrder = (payload: FinalOrderPayload): Promise<any> =>
  postJson("/api/public/orders/submit", payload, "Gagal memproses pesanan buku");

export interface WprEligibility {
  needsWpr: boolean;
  wprPrice: number;
}

export interface PendingOrderSummary {
  id: string;
  orderNumber: string;
  orderType: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  createdAt: string;
}

export interface StudentPendingOrders {
  bookOrder: PendingOrderSummary | null;
  uniformOrder: PendingOrderSummary | null;
}

/** Cek pesanan gantung murid sebelum submit portal (ADR-0021). */
export const checkPendingOrders = (studentId: string): Promise<StudentPendingOrders> =>
  getJson<StudentPendingOrders>(
    `/api/public/orders/check-pending/${encodeURIComponent(studentId)}`,
    "Gagal memeriksa status pesanan gantung."
  );

export const fetchWprEligibility = (studentId: string): Promise<WprEligibility> =>
  getJson<WprEligibility>(
    buildQuery("/api/public/orders/wpr-eligibility", { studentId }),
    "Gagal memeriksa status WPR."
  );

export interface LookupReturnableOrdersParams {
  query: string;
  schoolId: string;
}

export const lookupReturnableOrders = async (
  paramsOrQuery: LookupReturnableOrdersParams | string,
  legacySchoolId?: string
): Promise<PortalOrderLookup[]> => {
  const params: LookupReturnableOrdersParams =
    typeof paramsOrQuery === "string"
      ? { query: paramsOrQuery, schoolId: legacySchoolId ?? "" }
      : paramsOrQuery;

  try {
    return await getJson<PortalOrderLookup[]>(
      buildQuery("/api/public/orders/lookup-order", {
        query: params.query.trim(),
        schoolId: params.schoolId,
      }),
      "Gagal mencari pesanan."
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
};

/** Judul buku publik (alias samaran) untuk pilihan pada form refund. */
export const fetchBookChoices = (): Promise<PortalBookChoice[]> =>
  getJson<PortalBookChoice[]>("/api/public/orders/book-choices", "Gagal memuat daftar buku.");

export interface ReturnReportPayload {
  orderId: string;
  studentId: string;
  defectiveBookId: string;
  reason: string;
  photoProofBase64: string;
}

export interface ReturnReportResult {
  returnId: string;
  orderNumber: string;
  status: string;
}

export const submitReturnReport = (payload: ReturnReportPayload): Promise<ReturnReportResult> =>
  postJson<ReturnReportResult>(
    "/api/public/orders/submit-return",
    payload,
    "Gagal mengirimkan pengajuan refund buku."
  );

/* =========================================================================
 * Unified Uniform Portal Client Endpoints
 * ========================================================================= */

export const fetchUniformSchools = (): Promise<SchoolOption[]> =>
  getJson<SchoolOption[]>("/api/public/orders/schools", "Gagal memuat daftar sekolah.");

export type UniformStudentSearchParams = StudentSearchParams;

export const searchUniformStudents = (
  paramsOrQuery: UniformStudentSearchParams | string,
  legacySchoolId?: string
): Promise<UniformStudent[]> => {
  const params: UniformStudentSearchParams =
    typeof paramsOrQuery === "string"
      ? { query: paramsOrQuery, schoolId: legacySchoolId ?? "" }
      : paramsOrQuery;

  return getJson<UniformStudent[]>(
    buildQuery("/api/public/uniform-orders/search-students", {
      query: params.query.trim(),
      schoolId: params.schoolId,
    }),
    "Gagal melakukan pencarian siswa."
  );
};

export const fetchUniformCatalog = (academicYear: string): Promise<UniformCatalog> =>
  getJson<UniformCatalog>(
    buildQuery("/api/public/uniform-orders/catalog", { academicYear }),
    "Gagal memuat katalog seragam."
  );

export const fetchUniformSatuanStatus = (): Promise<{ open: boolean }> =>
  getJson<{ open: boolean }>("/api/public/uniform-orders/satuan-status", "Gagal memuat status satuan.");

export interface SubmittedUniformOrder {
  order: { id: string; orderNumber: string; shipmentStatus: string };
  totalAmount: number;
}

export const submitUniformOrder = (payload: SubmitUniformOrderPayload): Promise<SubmittedUniformOrder> =>
  postJson<SubmittedUniformOrder>("/api/public/uniform-orders/orders", payload, "Gagal memproses pesanan seragam.");

export interface UniformLookupOrder {
  id: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  academicYear: string;
  shipmentStatus: "belum_dikirim" | "sudah_dikirim";
  shippedAt: string | null;
  totalAmount: number;
  createdAt: string;
}

export interface UniformLookupItem {
  id: string;
  orderId: string;
  packageId: string | null;
  variantId: string | null;
  size: string;
  quantity: number;
  unitPriceSnapshot: number;
}

export const lookupUniformOrders = (params: { orderNumber?: string; studentId?: string; schoolId?: string }): Promise<{
  orders: UniformLookupOrder[];
  items: UniformLookupItem[];
  itemsByOrder: Record<string, UniformLookupItem[]>;
}> =>
  getJson(buildQuery("/api/public/uniform-orders/lookup-order", params), "Pesanan tidak ditemukan.");

export const requestUniformExchange = (payload: {
  orderId: string; studentId: string;
  oldVariantId: string; oldSize: string;
  newVariantId: string; newSize: string; reason: string;
  courierResi?: string;
}): Promise<unknown> =>
  postJson("/api/public/uniform-orders/exchange-requests", payload, "Gagal mengajukan tukar ukuran.");

export const getSportsExchangeTracking = (exchangeId: string): Promise<{
  courierResi?: string;
  fulfillmentType?: "ready" | "backorder";
  replacementResi?: string;
  estimatedShipDate?: string;
  updatedAt?: string;
}> =>
  getJson(`/api/public/uniform-orders/exchange-tracking/${exchangeId}`, "Gagal memuat pelacakan status penukaran.");

export const requestUniformRefund = (payload: {
  orderId: string; studentId: string; amount?: number; reason: string;
}): Promise<unknown> =>
  postJson("/api/public/uniform-orders/refund-requests", payload, "Gagal mengajukan refund.");
