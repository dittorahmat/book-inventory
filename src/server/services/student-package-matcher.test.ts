import { describe, it, expect } from "bun:test";
import {
  matchStudentToBookPackage,
  type BookPackageRecord,
} from "./student-package-matcher";

describe("matchStudentToBookPackage (§0.20)", () => {
  const samplePackages: BookPackageRecord[] = [
    {
      id: "pkg-1-inter-baru",
      code: "PKG-SD1-INTER-BARU",
      name: "Paket Buku SD Kelas 1 (INTER) Murid Baru/Pindahan TA 2026/2027",
      gradeLevel: "1",
      curriculumType: "INTER",
      intakeType: "baru",
      academicYear: "2026/2027",
      price: 3476200,
    },
    {
      id: "pkg-1-mq-baru",
      code: "PKG-SD1-MQ-BARU",
      name: "Paket Buku SD Kelas 1 (MQ) Murid Baru/Pindahan TA 2026/2027",
      gradeLevel: "1",
      curriculumType: "MQ",
      intakeType: "baru",
      academicYear: "2026/2027",
      price: 2770000,
    },
    {
      id: "pkg-2-inter-kenaikan",
      code: "PKG-SD2-INTER-NAIK",
      name: "Paket Buku SD Kelas 2 (INTER) Kenaikan Kelas TA 2026/2027",
      gradeLevel: "2",
      curriculumType: "INTER",
      intakeType: "kenaikan",
      academicYear: "2026/2027",
      price: 2017000,
    },
    {
      id: "pkg-2-inter-baru",
      code: "PKG-SD2-INTER-BARU",
      name: "Paket Buku SD Kelas 2 (INTER) Murid Baru/Pindahan TA 2026/2027",
      gradeLevel: "2",
      curriculumType: "INTER",
      intakeType: "baru",
      academicYear: "2026/2027",
      price: 2450000,
    },
  ];

  it("should match exact student attributes", () => {
    const student = {
      gradeLevel: "1",
      curriculumType: "INTER",
      intakeType: "baru",
      academicYear: "2026/2027",
    };
    const matched = matchStudentToBookPackage(student, samplePackages);
    expect(matched).not.toBeNull();
    expect(matched?.id).toBe("pkg-1-inter-baru");
  });

  it("should match different intake types for same grade", () => {
    const student = {
      gradeLevel: "2",
      curriculumType: "INTER",
      intakeType: "kenaikan",
      academicYear: "2026/2027",
    };
    const matched = matchStudentToBookPackage(student, samplePackages);
    expect(matched).not.toBeNull();
    expect(matched?.id).toBe("pkg-2-inter-kenaikan");
  });

  it("should map curriculum synonyms (international -> INTER, national -> MQ)", () => {
    const student = {
      gradeLevel: "1",
      curriculumType: "national",
      intakeType: "baru",
      academicYear: "2026/2027",
    };
    const matched = matchStudentToBookPackage(student, samplePackages);
    expect(matched).not.toBeNull();
    expect(matched?.id).toBe("pkg-1-mq-baru");
  });

  it("should return null when no package matches", () => {
    const student = {
      gradeLevel: "7",
      curriculumType: "INTER",
      intakeType: "baru",
      academicYear: "2026/2027",
    };
    const matched = matchStudentToBookPackage(student, samplePackages);
    expect(matched).toBeNull();
  });
});
