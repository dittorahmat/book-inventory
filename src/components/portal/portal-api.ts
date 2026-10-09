/**
 * Satu-satunya adapter tipis portal publik di atas fetch kanonik (`lib/api`).
 * Modul ini dilarang menyimpan state, menghitung total, atau merakit payload —
 * hanya pemetaan endpoint → getJson/postJson dengan pesan error Bahasa Indonesia.
 * Total optimistik tinggal di `lib/book-pricing` + `lib/transfer-pricing`,
 * resolusi paket di `lib/resolve-package`, perakitan payload di `order-payload`.
 */
import { buildQuery, getJson, postJson } from "../../lib/api";
import type {
  SchoolOption,
  StudentSearchResult,
  BookPackageOption,
  MatchedOrder,
  NewStudentForm,
  PackageBookChoice,
  SatuanStatus,
} from "../../lib/portal-types";

export const fetchSchools = (): Promise<SchoolOption[]> =>
  getJson<SchoolOption[]>("/api/schools", "Gagal memuat daftar sekolah.");

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
  getJson<BookPackageOption[]>("/api/packages", "Gagal memuat daftar paket buku.");

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
  orderType: "regular" | "scholarship";
  scholarshipProofBase64?: string;
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
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  category: string | null;
  coverUrl: string | null;
  sellPrice: number;
  price?: number | null;
}

/** Status keterbukaan order satuan (public, tanpa login). */
export const fetchSatuanStatus = (): Promise<SatuanStatus> =>
  getJson<SatuanStatus>("/api/public/orders/satuan-status", "Gagal memuat status order satuan");

/** Katalog satuan; kosong saat periode tertutup. */
export const fetchSatuanCatalog = (): Promise<{ open: boolean; status: SatuanStatus; books: SatuanBookOption[] }> =>
  getJson("/api/public/orders/satuan-catalog", "Gagal memuat daftar buku satuan");

export const submitFinalOrder = (payload: FinalOrderPayload): Promise<any> =>
  postJson("/api/public/orders/submit", payload, "Gagal memproses pesanan buku");

export const lookupOrders = (query: string, schoolId?: string): Promise<MatchedOrder[]> =>
  timed("lookup-order", () =>
    getJson<MatchedOrder[]>(
      buildQuery("/api/public/orders/lookup-order", { query: query.trim(), schoolId: schoolId || undefined }),
      "Pesanan tidak ditemukan"
    )
  );

export const fetchBookChoices = async (): Promise<PackageBookChoice[]> => {
  const list = await getJson<Array<{ id: string; title: string; isbn: string }>>(
    "/api/books",
    "Gagal memuat daftar buku."
  );
  return list.map((b) => ({ bookId: b.id, title: b.title, isbn: b.isbn }));
};

export interface ReturnReportPayload {
  orderId: string;
  studentId: string;
  defectiveBookId: string;
  reason: string;
  photoProofBase64: string;
}

export const submitReturnReport = (payload: ReturnReportPayload): Promise<any> =>
  postJson("/api/public/orders/submit-return", payload, "Gagal mengirimkan laporan retur.");
