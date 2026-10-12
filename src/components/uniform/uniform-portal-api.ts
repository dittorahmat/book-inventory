/**
 * Adapter tipis portal seragam di atas fetch kanonik (`lib/api`).
 * Tanpa state, tanpa hitung total — hanya pemetaan endpoint dengan pesan Indonesia.
 */
import { buildQuery, getJson, postJson } from "../../lib/api";
import type { UniformCatalog, SubmitUniformOrderPayload, UniformStudent } from "../../lib/uniform-types";
import type { SchoolOption } from "../../lib/portal-types";

export const fetchUniformSchools = (): Promise<SchoolOption[]> =>
  getJson<SchoolOption[]>("/api/schools", "Gagal memuat daftar sekolah.");

export const searchUniformStudents = (query: string, schoolId: string): Promise<UniformStudent[]> =>
  getJson<UniformStudent[]>(
    buildQuery("/api/public/uniform-orders/search-students", { query: query.trim(), schoolId }),
    "Gagal melakukan pencarian siswa."
  );

export const fetchUniformCatalog = (academicYear: string): Promise<UniformCatalog> =>
  getJson<UniformCatalog>(
    buildQuery("/api/public/uniform-orders/catalog", { academicYear }),
    "Gagal memuat katalog seragam."
  );

export interface SubmittedUniformOrder {
  order: { id: string; orderNumber: string; shipmentStatus: string };
  totalAmount: number;
}

export const submitUniformOrder = (payload: SubmitUniformOrderPayload): Promise<SubmittedUniformOrder> =>
  postJson<SubmittedUniformOrder>("/api/public/uniform-orders/orders", payload, "Gagal memproses pesanan seragam.");
