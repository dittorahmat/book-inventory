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

export const searchStudents = (query: string, schoolId: string): Promise<StudentSearchResult[]> =>
  timed("search-students", () =>
    getJson<StudentSearchResult[]>(
      buildQuery("/api/public/orders/search-students", { query: query.trim(), schoolId }),
      "Gagal melakukan pencarian siswa."
    )
  );

export const registerStudent = (payload: NewStudentForm): Promise<any> =>
  postJson("/api/public/orders/register-student", payload, "Gagal mendaftarkan siswa baru");

export interface FinalOrderPayload {
  studentId: string;
  packageId?: string;
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

/** Katalog satuan; kosong saat periode tertutup. */
export const fetchSatuanCatalog = (): Promise<{ open: boolean; status: SatuanStatus; books: SatuanBookOption[] }> =>
  getJson("/api/public/orders/satuan-catalog", "Gagal memuat daftar buku satuan");

export const submitFinalOrder = (payload: FinalOrderPayload): Promise<any> =>
  postJson("/api/public/orders/submit", payload, "Gagal memproses pesanan buku");

export interface WprEligibility {
  needsWpr: boolean;
  wprPrice: number;
}

/** Status WPR murid: hijau (bebas) bila sudah punya order paket. */
export const fetchWprEligibility = (studentId: string): Promise<WprEligibility> =>
  getJson<WprEligibility>(
    buildQuery("/api/public/orders/wpr-eligibility", { studentId }),
    "Gagal memeriksa status WPR."
  );

/**
 * Pencarian pesanan untuk alur refund buku. Server membalas 404 saat tidak ada
 * yang cocok; itu keadaan normal (empty state), bukan kegagalan, jadi
 * dikembalikan sebagai daftar kosong alih-alih melempar banner galat.
 */
export const lookupReturnableOrders = async (
  query: string,
  schoolId: string
): Promise<PortalOrderLookup[]> => {
  try {
    return await getJson<PortalOrderLookup[]>(
      buildQuery("/api/public/orders/lookup-order", { query: query.trim(), schoolId }),
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
