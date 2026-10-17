import { eq, sql } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { studentBookOrders, students } from "../../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch, writeNow, newWriteId, type WriteDeps } from "../lib/d1-write";
import { documentNumber, epochTimeFragment } from "../lib/document-number";

export type LifecycleError = { ok: false; status: ContentfulStatusCode; message: string };

export type LifecycleDeps = WriteDeps;

/** Satu-satunya kanonik NIS: pangkas spasi dan lipat case agar "Adi" = "adi". */
export const normalizeNis = (nis: string): string => nis.trim().toLowerCase();

/**
 * Satu-satunya guard NIS: case-insensitive di seluruh tabel, dipakai
 * create/update/verify/bulk agar tak ada jalur yang lolos beda case.
 */
export async function checkNisTaken(
  database: AppDatabase,
  nis: string,
  exceptId?: string
): Promise<boolean> {
  const rows = await database
    .select({ id: students.id })
    .from(students)
    .where(eq(sql`lower(${students.nis})`, normalizeNis(nis)));
  return rows.some((r: { id: string }) => r.id !== exceptId);
}

export interface StudentImportRow {
  nis: string;
  name: string;
  gradeLevel: string;
  gender?: "male" | "female";
  curriculumType?: "international" | "national";
  academicYear?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  status?: "active" | "promoted" | "new_pending" | "rejected" | "graduated";
  isScholarship?: boolean;
}

export type ImportStudentsResult =
  | { ok: true; data: { insertedCount: number; updatedCount: number; total: number } }
  | LifecycleError;

/**
 * Satu-satunya pemilik bulk-import siswa: tolak duplikat NIS di dalam
 * payload sebelum tulis, lalu upsert berdasarkan sekolah + NIS lipat-case.
 * Insert di-chunk max 10 baris, seluruh tulis satu batch sekuensial (§10 D1).
 */
export async function importStudents(
  database: AppDatabase,
  schoolId: string,
  rows: StudentImportRow[],
  deps?: LifecycleDeps
): Promise<ImportStudentsResult> {
  const folded = rows.map((r) => normalizeNis(r.nis));
  const seenFolded = new Set<string>();
  const duplicateFolded = folded.find((nis) => {
    if (seenFolded.has(nis)) return true;
    seenFolded.add(nis);
    return false;
  });
  if (duplicateFolded) {
    return { ok: false, status: 400, message: `NIS duplikat dalam file impor: ${rows[folded.indexOf(duplicateFolded)].nis.trim()}. Satu NIS hanya boleh muncul sekali.` };
  }

  const now = writeNow(deps);
  const existing = await database
    .select({ id: students.id, nis: students.nis })
    .from(students)
    .where(eq(students.schoolId, schoolId));
  const existingMap = new Map<string, string>(existing.map((s: { id: string; nis: string }) => [normalizeNis(s.nis), s.id]));

  const insertRows: Array<typeof students.$inferInsert> = [];
  const updateQueries: unknown[] = [];
  let insertedCount = 0;
  let updatedCount = 0;
  for (const item of rows) {
    const cleanNis = item.nis.trim();
    const existingId: string | undefined = existingMap.get(normalizeNis(item.nis));
    const values = {
      name: item.name,
      gradeLevel: item.gradeLevel,
      gender: item.gender ?? "male",
      curriculumType: item.curriculumType ?? "international",
      academicYear: item.academicYear ?? "2026/2027",
      parentName: item.parentName || null,
      parentEmail: item.parentEmail || null,
      parentPhone: item.parentPhone || null,
      status: item.status ?? "active",
      isScholarship: item.isScholarship ?? false,
      updatedAt: now,
    };
    if (existingId) {
      updateQueries.push(database.update(students).set(values).where(eq(students.id, existingId)));
      updatedCount++;
    } else {
      const newId = newWriteId(deps);
      insertRows.push({ id: newId, schoolId, nis: cleanNis, ...values, createdAt: now });
      existingMap.set(normalizeNis(item.nis), newId);
      insertedCount++;
    }
  }

  try {
    await runWriteBatch(database, [
      ...chunkRows(insertRows).map((chunk) => database.insert(students).values(chunk)),
      ...updateQueries,
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "impor siswa");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return { ok: true, data: { insertedCount, updatedCount, total: rows.length } };
}

export type RemoveStudentResult =
  | { ok: true; data: { studentId: string } }
  | LifecycleError;

export interface RegisterPublicStudentInput {
  schoolId: string;
  name: string;
  gender: "male" | "female";
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
}

export type RegisterPublicStudentResult =
  | { ok: true; data: typeof students.$inferSelect }
  | LifecycleError;

/**
 * Satu-satunya pemilik registrasi publik: NIS sementara REG-*, status
 * new_pending, dan error D1 yang dipetakan ke 4xx tinggal di balik satu
 * seam ini agar tak ada insert mentah yang melewatinya.
 */
export async function registerPublicStudent(
  database: AppDatabase,
  input: RegisterPublicStudentInput,
  deps?: LifecycleDeps
): Promise<RegisterPublicStudentResult> {
  const now = writeNow(deps);
  const id = newWriteId(deps);
  const tempNis = documentNumber("REG", epochTimeFragment(Date.now(), 6));
  try {
    await database.insert(students).values({
      id,
      schoolId: input.schoolId,
      nis: tempNis,
      name: input.name,
      gender: input.gender,
      gradeLevel: input.gradeLevel,
      curriculumType: input.curriculumType,
      academicYear: input.academicYear,
      parentName: input.parentName,
      parentEmail: input.parentEmail,
      parentPhone: input.parentPhone,
      status: "new_pending",
      isScholarship: false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pendaftaran siswa");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const [created] = await database.select().from(students).where(eq(students.id, id));
  if (!created) return { ok: false, status: 500, message: "Pendaftaran siswa gagal disimpan" };
  return { ok: true, data: created };
}

/** Target kelas: promosi naik satu tingkat bila numerik, selain itu tetap. */
export const resolveTargetGradeLevel = (gradeLevel: string, status: string): string => {
  const current = parseInt(gradeLevel, 10);
  return status === "promoted" && !Number.isNaN(current) ? (current + 1).toString() : gradeLevel;
};

export interface EligibilityView {
  detectedStatus: "naik_kelas" | "aktif" | "baru";
  currentGradeLevel: string;
  targetGradeLevel: string;
  canOrder: boolean;
  orderBlockedReason: string | null;
}

/**
 * Satu-satunya pemeta tampilan kelayakan portal: status samaran +
 * target kelas + gerbang order dalam satu tempat agar route tipis.
 */
export const toEligibilityView = <T extends { gradeLevel: string; status: string }>(
  student: T,
  eligibility: { ok: boolean; message?: string }
): EligibilityView => ({
  detectedStatus: student.status === "promoted" ? "naik_kelas" : student.status === "active" ? "aktif" : "baru",
  currentGradeLevel: student.gradeLevel,
  targetGradeLevel: resolveTargetGradeLevel(student.gradeLevel, student.status),
  canOrder: eligibility.ok,
  orderBlockedReason: eligibility.ok ? null : (eligibility.message ?? "Tidak dapat memesan"),
});

/**
 * Satu-satunya pemilik hapus siswa: guard riwayat pesanan (dengan nomor
 * pesanan di pesan) tinggal serumah dengan delete agar tak ada jalur
 * hapus yang melewati guard PII ini.
 */
export async function removeStudent(
  database: AppDatabase,
  studentId: string
): Promise<RemoveStudentResult> {
  const [existing] = await database.select().from(students).where(eq(students.id, studentId));
  if (!existing) {
    return { ok: false, status: 404, message: "Data siswa tidak ditemukan" };
  }

  const existingOrders = await database
    .select({ orderNumber: studentBookOrders.orderNumber })
    .from(studentBookOrders)
    .where(eq(studentBookOrders.studentId, studentId));
  if (existingOrders.length > 0) {
    const orderNumbers = existingOrders.map((o: { orderNumber: string }) => o.orderNumber).join(", ");
    return {
      ok: false,
      status: 400,
      message: `Data siswa "${(existing as { name: string }).name}" tidak dapat dihapus karena memiliki riwayat pesanan buku: ${orderNumbers}. Silakan hapus pesanan tersebut terlebih dahulu di menu Pesanan Siswa.`,
    };
  }

  await database.delete(students).where(eq(students.id, studentId));
  return { ok: true, data: { studentId } };
}
