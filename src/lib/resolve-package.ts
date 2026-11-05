import { curriculumLabel } from "./curriculum";

export { curriculumLabel };

export interface LockablePackage {
  id: string;
  gradeLevel: string;
  curriculumType: string;
  academicYear: string;
  stream?: string | null;
  intakeType?: string | null;
}

export interface LockableStudent {
  targetGradeLevel: string;
  curriculumType: string;
  stream?: string | null;
  intakeType?: string | null;
}

/**
 * Resolve the single locked book package for a student.
 * Match key: (targetGradeLevel, curriculumType, stream, intakeType), preferring the
 * latest academicYear when multiple candidates exist.
 * Returns null when no package matches (caller shows the
 * "hubungi admin" empty state).
 */
export function resolveLockedPackage<T extends LockablePackage>(
  student: LockableStudent | null | undefined,
  packages: T[]
): T | null {
  if (!student || !packages || packages.length === 0) return null;

  const candidates = packages.filter((p) => {
    if (p.gradeLevel !== student.targetGradeLevel) return false;

    // Normalisasi perbandingan kurikulum (case-insensitive)
    const pCurr = p.curriculumType.toUpperCase();
    const sCurr = student.curriculumType.toUpperCase();
    if (pCurr !== sCurr) {
      // Dukungan kompatibilitas mundur: "INTERNATIONAL" -> "INTER", "NATIONAL" -> "MQ"
      const isCompat =
        (sCurr === "INTERNATIONAL" && (pCurr === "INTER" || pCurr === "TK" || pCurr === "AE" || pCurr === "ME" || pCurr === "DI")) ||
        (sCurr === "NATIONAL" && pCurr === "MQ");
      if (!isCompat) return false;
    }

    // Cocokkan stream (IPA / IPS) jika paket atau murid memiliki penjurusan
    if (student.stream || p.stream) {
      if ((student.stream ?? null) !== (p.stream ?? null)) return false;
    }

    // Cocokkan intakeType (baru / kenaikan) jika paket memiliki intakeType
    if (student.intakeType && p.intakeType) {
      if (student.intakeType !== p.intakeType) return false;
    }

    return true;
  });

  return candidates.reduce<T | null>((a, b) => (!a || b.academicYear > a.academicYear ? b : a), null);
}
