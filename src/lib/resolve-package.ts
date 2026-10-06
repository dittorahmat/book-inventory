export interface LockablePackage {
  id: string;
  gradeLevel: string;
  curriculumType: string;
  academicYear: string;
}

export interface LockableStudent {
  targetGradeLevel: string;
  curriculumType: string;
}

/**
 * Resolve the single locked book package for a student.
 * Match key: (targetGradeLevel, curriculumType), preferring the
 * latest academicYear when multiple candidates exist.
 * Returns null when no package matches (caller shows the
 * "hubungi admin" empty state).
 */
export function resolveLockedPackage<T extends LockablePackage>(
  student: LockableStudent | null | undefined,
  packages: T[]
): T | null {
  if (!student || !packages || packages.length === 0) return null;
  const candidates = packages.filter((p) => p.gradeLevel === student.targetGradeLevel && p.curriculumType === student.curriculumType);
  return candidates.reduce<T | null>((a, b) => (!a || b.academicYear > a.academicYear ? b : a), null);
}

export const curriculumLabel = (curriculumType: string): string => (curriculumType === "international" ? "Internasional" : "Nasional");
