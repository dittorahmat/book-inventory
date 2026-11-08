import { CURRICULUM_TYPES, type CurriculumType } from "../db/schema";

export { CURRICULUM_TYPES, type CurriculumType };

export const CANONICAL_CURRICULUM_OPTIONS: Array<{ value: CurriculumType; label: string }> = [
  { value: "TK", label: "TK / Preschool" },
  { value: "INTER", label: "SD Internasional" },
  { value: "AE", label: "Al-Wildan English (AE)" },
  { value: "ME", label: "Middle East (ME)" },
  { value: "DI", label: "Dual International (DI)" },
  { value: "MQ", label: "Markaz Al-Qur'an (MQ)" },
];

/**
 * Filter kurikulum yang valid berdasarkan jenjang tingkat kelas murid:
 * - TK (gradeLevel "TK" atau "0"): TK
 * - SD (gradeLevel "1".."6"): INTER, MQ
 * - SMP/SMA (gradeLevel "7".."12"): AE, ME, DI, MQ
 */
export function getAvailableCurriculaForGrade(gradeLevel: string): Array<{ value: CurriculumType; label: string }> {
  const norm = gradeLevel.trim().toUpperCase();
  if (norm.startsWith("TK") || norm === "0") {
    return CANONICAL_CURRICULUM_OPTIONS.filter((c) => c.value === "TK");
  }
  const gradeNum = parseInt(norm, 10);
  if (!Number.isNaN(gradeNum)) {
    if (gradeNum >= 1 && gradeNum <= 6) {
      return CANONICAL_CURRICULUM_OPTIONS.filter((c) => c.value === "INTER" || c.value === "MQ");
    }
    if (gradeNum >= 7 && gradeNum <= 12) {
      return CANONICAL_CURRICULUM_OPTIONS.filter((c) => ["AE", "ME", "DI", "MQ"].includes(c.value));
    }
  }
  return CANONICAL_CURRICULUM_OPTIONS;
}

export const curriculumLabel = (curriculumType: string): string => {
  const norm = curriculumType.toUpperCase();
  switch (norm) {
    case "INTER":
    case "INTERNATIONAL":
      return "Internasional";
    case "NATIONAL":
      return "Nasional";
    case "MQ":
      return "Markaz Al-Qur'an (Nasional Plus)";
    case "TK":
      return "TK / Preschool";
    case "AE":
      return "Al-Wildan English (AE)";
    case "ME":
      return "Middle East (ME)";
    case "DI":
      return "Dual International (DI)";
    default:
      return curriculumType;
  }
};

/**
 * Deteksi intakeType (baru / kenaikan) berdasarkan prefix NIS dan tahun ajaran aktif.
 * Contoh: academicYear = "2026/2027" -> 4-digit prefix = "2627".
 * Jika NIS diawali 2627 -> baru, lainnya -> kenaikan.
 */
export function determineIntakeType(nis: string, academicYear: string): "baru" | "kenaikan" {
  const digitsOnly = academicYear.replace(/\D/g, "");
  // Ambil 2 digit akhir tahun awal dan 2 digit akhir tahun akhir: "20262027" -> "26" + "27" = "2627"
  const expectedPrefix =
    digitsOnly.length >= 8
      ? digitsOnly.slice(2, 4) + digitsOnly.slice(6, 8)
      : digitsOnly.slice(-4);

  return nis.trim().startsWith(expectedPrefix) ? "baru" : "kenaikan";
}
