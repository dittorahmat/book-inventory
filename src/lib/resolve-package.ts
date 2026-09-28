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
  const candidates = packages.filter(
    (p) =>
      p.gradeLevel === student.targetGradeLevel &&
      p.curriculumType === student.curriculumType
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) =>
    b.academicYear.localeCompare(a.academicYear)
  )[0];
}

export function curriculumLabel(curriculumType: string): string {
  return curriculumType === "international" ? "Internasional" : "Nasional";
}
