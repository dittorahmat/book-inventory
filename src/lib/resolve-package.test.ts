import { describe, expect, it } from "bun:test";
import { resolveLockedPackage, curriculumLabel } from "./resolve-package";

const intPkg2026 = { id: "pkg-2-int-26", gradeLevel: "2", curriculumType: "international", academicYear: "2026/2027" };
const intPkg2025 = { id: "pkg-2-int-25", gradeLevel: "2", curriculumType: "international", academicYear: "2025/2026" };
const nasPkg = { id: "pkg-2-nas", gradeLevel: "2", curriculumType: "national", academicYear: "2026/2027" };

describe("resolveLockedPackage (portal paket terkunci)", () => {
  it("locks the single package matching target grade + curriculum", () => {
    const student = { targetGradeLevel: "2", curriculumType: "international" };
    const locked = resolveLockedPackage(student, [intPkg2026, nasPkg]);
    expect(locked?.id).toBe("pkg-2-int-26");
  });

  it("prefers the latest academicYear when multiple candidates match", () => {
    const student = { targetGradeLevel: "2", curriculumType: "international" };
    const locked = resolveLockedPackage(student, [intPkg2025, intPkg2026]);
    expect(locked?.id).toBe("pkg-2-int-26");
  });

  it("returns null when no package matches (empty state hubungi admin)", () => {
    const student = { targetGradeLevel: "3", curriculumType: "international" };
    expect(resolveLockedPackage(student, [intPkg2026, nasPkg])).toBeNull();
  });

  it("returns null for empty package list or missing student", () => {
    const student = { targetGradeLevel: "2", curriculumType: "national" };
    expect(resolveLockedPackage(student, [])).toBeNull();
    expect(resolveLockedPackage(null, [nasPkg])).toBeNull();
    expect(resolveLockedPackage(undefined, [nasPkg])).toBeNull();
  });

  it("labels curricula in Bahasa Indonesia", () => {
    expect(curriculumLabel("international")).toBe("Internasional");
    expect(curriculumLabel("national")).toBe("Nasional");
  });
});
