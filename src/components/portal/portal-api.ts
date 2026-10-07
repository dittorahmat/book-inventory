import { readJson } from "../../lib/api";
import type {
  SchoolOption,
  StudentSearchResult,
  BookPackageOption,
  MatchedOrder,
  NewStudentForm,
  PackageBookChoice,
} from "../../lib/portal-types";

export async function fetchSchools(): Promise<SchoolOption[]> {
  const res = await fetch("/api/schools");
  const data = await readJson(res, "Gagal memuat daftar sekolah.");
  return data.data;
}

export async function fetchPackages(): Promise<BookPackageOption[]> {
  const res = await fetch("/api/packages");
  const data = await readJson(res, "Gagal memuat daftar paket buku.");
  return data.data;
}

export async function searchStudents(query: string): Promise<StudentSearchResult[]> {
  const res = await fetch(
    `/api/public/orders/search-students?query=${encodeURIComponent(query.trim())}`
  );
  const data = await readJson(res, "Gagal melakukan pencarian siswa.");
  return data.data;
}

export async function registerStudent(payload: NewStudentForm): Promise<any> {
  const res = await fetch("/api/public/orders/register-student", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res, "Gagal mendaftarkan siswa baru");
  return data.data;
}

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

export interface SatuanStatus {
  academicYear: string;
  open: boolean;
  todayWIB: string;
  openFrom: string | null;
  override: "open" | "closed" | null;
  reason: string;
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
}

/** Status keterbukaan order satuan (public, tanpa login). */
export async function fetchSatuanStatus(): Promise<SatuanStatus> {
  const res = await fetch("/api/public/orders/satuan-status");
  const data = await readJson(res, "Gagal memuat status order satuan");
  return data.data;
}

/** Katalog satuan; kosong saat periode tertutup. */
export async function fetchSatuanCatalog(): Promise<{ open: boolean; status: SatuanStatus; books: SatuanBookOption[] }> {
  const res = await fetch("/api/public/orders/satable-catalog");
  const data = await readJson(res, "Gagal memuat daftar buku satuan");
  return data.data;
}

export async function submitFinalOrder(payload: FinalOrderPayload): Promise<any> {
  const res = await fetch("/api/public/orders/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res, "Gagal memproses pesanan buku");
  return data.data;
}

export async function lookupOrders(query: string): Promise<MatchedOrder[]> {
  const res = await fetch(
    `/api/public/orders/lookup-order?query=${encodeURIComponent(query.trim())}`
  );
  const data = await readJson(res, "Pesanan tidak ditemukan");
  return data.data;
}

export async function fetchBookChoices(): Promise<PackageBookChoice[]> {
  const res = await fetch(`/api/books`);
  const data = await readJson(res, "Gagal memuat daftar buku.");
  return data.data.map((b: any) => ({
    bookId: b.id,
    title: b.title,
    isbn: b.isbn,
  }));
}

export interface ReturnReportPayload {
  orderId: string;
  studentId: string;
  defectiveBookId: string;
  reason: string;
  photoProofBase64: string;
}

export async function submitReturnReport(payload: ReturnReportPayload): Promise<any> {
  const res = await fetch("/api/public/orders/submit-return", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res, "Gagal mengirimkan laporan retur.");
  return data.data;
}
