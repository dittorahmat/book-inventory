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

async function readJson(res: Response, fallback: string) {
  let data: any = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(fallback);
  }
  if (!res.ok || !data || data.success === false) {
    throw new Error((data && (data.message || data.error)) || fallback);
  }
  return data;
}

function toQuery(params: StudentListParams): string {
  const q = new URLSearchParams();
  if (params.schoolId) q.set("schoolId", params.schoolId);
  if (params.status && params.status !== "all") q.set("status", params.status);
  if (params.search?.trim()) q.set("search", params.search.trim());
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchSchools(): Promise<SchoolOption[]> {
  const res = await fetch("/api/schools");
  const data = await readJson(res, "Gagal memuat daftar sekolah.");
  return data.data;
}

export async function fetchStudents(params: StudentListParams): Promise<StudentRecord[]> {
  const res = await fetch(`/api/students${toQuery(params)}`);
  const data = await readJson(res, "Gagal memuat data siswa.");
  return data.data;
}

export async function createStudent(payload: StudentFormPayload): Promise<StudentRecord> {
  const res = await fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res, "Gagal menyimpan data siswa.");
  return data.data;
}

export async function updateStudent(id: string, payload: Partial<StudentFormPayload>): Promise<StudentRecord> {
  const res = await fetch(`/api/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res, "Gagal memperbarui data siswa.");
  return data.data;
}

export async function deleteStudent(id: string): Promise<void> {
  const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
  await readJson(res, "Gagal menghapus data siswa.");
}

export async function verifyStudent(
  id: string,
  action: "approve" | "reject",
  nis?: string
): Promise<StudentRecord> {
  const res = await fetch(`/api/students/${id}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nis ? { action, nis } : { action }),
  });
  const data = await readJson(res, "Gagal memverifikasi siswa.");
  return data.data;
}
