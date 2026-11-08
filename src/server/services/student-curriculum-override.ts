import { eq } from "drizzle-orm";
import { type AppDatabase } from "../../db";
import { students, schools, type CurriculumType, type StreamType } from "../../db/schema";
import { toBookSearchView } from "./public-order";
import { getAvailableCurriculaForGrade } from "../../lib/curriculum";

export interface UpdateStudentCurriculumInput {
  nis: string;
  parentName: string;
  parentPhone: string;
  curriculumType: CurriculumType;
  stream?: StreamType | null;
}

export type UpdateStudentCurriculumResult =
  | {
      ok: true;
      data: ReturnType<typeof toBookSearchView>;
    }
  | {
      ok: false;
      status: 400 | 404 | 500;
      message: string;
    };

/**
 * Memperbarui kurikulum & peminatan siswa secara mandiri oleh orang tua (Issue #338).
 * Menjaga integritas data siswa, mencatat kontak ortu, dan mengembalikan view aman portal.
 */
export async function updateStudentCurriculum(
  database: AppDatabase,
  studentId: string,
  input: UpdateStudentCurriculumInput
): Promise<UpdateStudentCurriculumResult> {
  const [existing] = await database
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      schoolId: students.schoolId,
      schoolName: schools.name,
      gradeLevel: students.gradeLevel,
      curriculumType: students.curriculumType,
      stream: students.stream,
      academicYear: students.academicYear,
      status: students.status,
      isScholarship: students.isScholarship,
      gender: students.gender,
      parentName: students.parentName,
      parentEmail: students.parentEmail,
      parentPhone: students.parentPhone,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(eq(students.id, studentId));

  if (!existing) {
    return {
      ok: false,
      status: 404,
      message: "Data siswa tidak ditemukan",
    };
  }

  // Validasi kecocokan NIS
  if (existing.nis.trim() !== input.nis.trim()) {
    return {
      ok: false,
      status: 400,
      message: "NIS tidak sesuai dengan data siswa terdaftar",
    };
  }

  // Validasi kurikulum valid sesuai jenjang kelas
  const allowedCurricula = getAvailableCurriculaForGrade(existing.gradeLevel).map((c) => c.value);
  if (!allowedCurricula.includes(input.curriculumType)) {
    return {
      ok: false,
      status: 400,
      message: `Pilihan kurikulum tidak tersedia untuk tingkat kelas ${existing.gradeLevel}`,
    };
  }

  const now = new Date().toISOString();
  await database
    .update(students)
    .set({
      curriculumType: input.curriculumType,
      stream: input.stream ?? null,
      parentName: input.parentName.trim(),
      parentPhone: input.parentPhone.trim(),
      updatedAt: now,
    })
    .where(eq(students.id, studentId));

  const updatedRow = {
    ...existing,
    curriculumType: input.curriculumType,
    stream: input.stream ?? null,
    parentName: input.parentName.trim(),
    parentPhone: input.parentPhone.trim(),
  };

  const searchView = toBookSearchView(updatedRow);

  return {
    ok: true,
    data: searchView,
  };
}
