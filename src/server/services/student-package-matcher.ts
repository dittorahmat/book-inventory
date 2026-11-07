/**
 * Matcher Kanonik Paket Buku Siswa (§0.1, §0.20)
 * Memetakan atribut siswa (jenjang, kurikulum, tipe intake) ke paket buku yang tepat.
 */

export interface StudentPackageAttributes {
  gradeLevel: string;
  curriculumType: string;
  intakeType?: string | null;
  academicYear?: string | null;
}

export interface BookPackageRecord {
  id: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: string;
  intakeType: string;
  academicYear: string;
  price: number;
}

export function matchStudentToBookPackage(
  student: StudentPackageAttributes,
  packages: BookPackageRecord[]
): BookPackageRecord | null {
  const targetYear = student.academicYear || "2026/2027";
  const studentIntake = student.intakeType || "baru";
  const normCurriculum = student.curriculumType.toUpperCase();

  // 1. Exact match (grade, curriculum, intake, academicYear)
  const exact = packages.find(
    (p) =>
      p.academicYear === targetYear &&
      p.gradeLevel === student.gradeLevel &&
      p.curriculumType.toUpperCase() === normCurriculum &&
      p.intakeType.toLowerCase() === studentIntake.toLowerCase()
  );
  if (exact) return exact;

  // 2. Fallback ignore intakeType if specific package doesn't differentiate
  const fallbackIntake = packages.find(
    (p) =>
      p.academicYear === targetYear &&
      p.gradeLevel === student.gradeLevel &&
      p.curriculumType.toUpperCase() === normCurriculum
  );
  if (fallbackIntake) return fallbackIntake;

  // 3. Fallback for curriculum naming variation (international <-> INTER, national <-> MQ)
  const mappedCurriculum =
    normCurriculum === "INTERNATIONAL"
      ? "INTER"
      : normCurriculum === "NATIONAL"
      ? "MQ"
      : normCurriculum;

  return (
    packages.find(
      (p) =>
        p.academicYear === targetYear &&
        p.gradeLevel === student.gradeLevel &&
        p.curriculumType.toUpperCase() === mappedCurriculum &&
        p.intakeType.toLowerCase() === studentIntake.toLowerCase()
    ) ||
    packages.find(
      (p) =>
        p.academicYear === targetYear &&
        p.gradeLevel === student.gradeLevel &&
        p.curriculumType.toUpperCase() === mappedCurriculum
    ) ||
    null
  );
}
