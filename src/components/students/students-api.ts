import { apiEnvelope, buildQuery, delJson, getJson, postJson, putJson } from "../../lib/api";

/** Opsi sekolah kanonik (id + nama + kode) dipakai ulang dari tipe portal. */
import type { SchoolOption } from "../../lib/portal-types";
export type { SchoolOption };

export interface StudentRecord {
  id: string;
  nis: string;
  name: string;
  gender?: string | null;
  gradeLevel: string;
  rombel?: string | null;
  curriculumType: string;
  academicYear: string;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  status: string;
  isScholarship: boolean;
  hasTakenPackage?: boolean;
  packageReceivedAt?: string | null;
  hasTakenUniform?: boolean;
  uniformReceivedAt?: string | null;
  schoolId: string;
  schoolName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentListParams {
  schoolId?: string;
  status?: string;
  rombel?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface StudentPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StudentFormPayload {
  schoolId: string;
  nis: string;
  name: string;
  gender: "male" | "female";
  gradeLevel: string;
  rombel?: string;
  curriculumType: "international" | "national";
  academicYear: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  status?: string;
  isScholarship?: boolean;
}

export const fetchSchools = (): Promise<SchoolOption[]> =>
  getJson<SchoolOption[]>("/api/schools", "Gagal memuat daftar sekolah.");

export const fetchSchoolRombels = (schoolId?: string): Promise<string[]> =>
  getJson<string[]>(
    buildQuery("/api/students/rombels", {
      schoolId: schoolId && schoolId !== "all" ? schoolId : undefined,
    }),
    "Gagal memuat daftar rombel."
  );

export const fetchStudents = async (
  params: StudentListParams
): Promise<{ students: StudentRecord[]; pagination?: StudentPaginationMeta }> => {
  const envelope = await apiEnvelope<{ data: StudentRecord[]; pagination?: StudentPaginationMeta }>(
    buildQuery("/api/students", {
      schoolId: params.schoolId,
      status: params.status && params.status !== "all" ? params.status : undefined,
      rombel: params.rombel && params.rombel !== "all" ? params.rombel : undefined,
      search: params.search?.trim() || undefined,
      page: params.page ? String(params.page) : undefined,
      limit: params.limit ? String(params.limit) : undefined,
    }),
    undefined,
    "Gagal memuat data siswa."
  );

  return {
    students: envelope.data ?? [],
    pagination: envelope.pagination,
  };
};

export const fetchStudentActiveOrders = (
  id: string
): Promise<{ hasActive: boolean; details: string[] }> =>
  getJson<{ hasActive: boolean; details: string[] }>(
    `/api/students/${encodeURIComponent(id)}/active-orders`,
    "Gagal memeriksa pesanan aktif siswa."
  );

export const createStudent = (payload: StudentFormPayload): Promise<StudentRecord> =>
  postJson<StudentRecord>("/api/students", payload, "Gagal menyimpan data siswa.");

export const updateStudent = (id: string, payload: Partial<StudentFormPayload>): Promise<StudentRecord> =>
  putJson<StudentRecord>(`/api/students/${id}`, payload, "Gagal memperbarui data siswa.");

export const deleteStudent = (id: string): Promise<void> =>
  delJson<void>(`/api/students/${id}`, "Gagal menghapus data siswa.");

export const verifyStudent = (id: string, action: "approve" | "reject", nis?: string): Promise<StudentRecord> =>
  postJson<StudentRecord>(`/api/students/${id}/verify`, nis ? { action, nis } : { action }, "Gagal memverifikasi siswa.");
