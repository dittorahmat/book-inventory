import { buildQuery, delJson, getJson, postJson, putJson } from "../../lib/api";

export interface StudentRecord {
  id: string;
  nis: string;
  name: string;
  gender?: string | null;
  gradeLevel: string;
  curriculumType: string;
  academicYear: string;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  status: string;
  isScholarship: boolean;
  schoolId: string;
  schoolName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolOption {
  id: string;
  name: string;
}

export interface StudentListParams {
  schoolId?: string;
  status?: string;
  search?: string;
}

export interface StudentFormPayload {
  schoolId: string;
  nis: string;
  name: string;
  gender: "male" | "female";
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  status?: string;
}

export const fetchSchools = (): Promise<SchoolOption[]> =>
  getJson<SchoolOption[]>("/api/schools", "Gagal memuat daftar sekolah.");

export const fetchStudents = (params: StudentListParams): Promise<StudentRecord[]> =>
  getJson<StudentRecord[]>(
    buildQuery("/api/students", {
      schoolId: params.schoolId,
      status: params.status && params.status !== "all" ? params.status : undefined,
      search: params.search?.trim() || undefined,
    }),
    "Gagal memuat data siswa."
  );

export const createStudent = (payload: StudentFormPayload): Promise<StudentRecord> =>
  postJson<StudentRecord>("/api/students", payload, "Gagal menyimpan data siswa.");

export const updateStudent = (id: string, payload: Partial<StudentFormPayload>): Promise<StudentRecord> =>
  putJson<StudentRecord>(`/api/students/${id}`, payload, "Gagal memperbarui data siswa.");

export const deleteStudent = (id: string): Promise<void> =>
  delJson<void>(`/api/students/${id}`, "Gagal menghapus data siswa.");

export const verifyStudent = (id: string, action: "approve" | "reject", nis?: string): Promise<StudentRecord> =>
  postJson<StudentRecord>(`/api/students/${id}/verify`, nis ? { action, nis } : { action }, "Gagal memverifikasi siswa.");
