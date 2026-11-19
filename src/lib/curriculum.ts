import { sql, type SQL } from "drizzle-orm";
import { CURRICULUM_TYPES, type CurriculumType } from "../db/schema";

export { CURRICULUM_TYPES, type CurriculumType };

export const CANONICAL_GRADES = ["TK", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export const SEMESTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Tahunan (Sem 1 & 2)" },
  { value: "1", label: "Semester 1 (Ganjil)" },
  { value: "2", label: "Semester 2 (Genap)" },
];

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

/**
 * Mendeteksi tipe kurikulum kanonik dari teks (judul sheet, baris header/catatan, atau kolom kurikulum).
 * Mendukung seluruh jenjang Al-Wildan:
 * - TK / Preschool: 'TK'
 * - SD: 'INTER', 'MQ'
 * - SMP & SMA: 'AE', 'ME', 'DI', 'MQ'
 */
export function inferCurriculumFromText(text: string, gradeLevel?: string): CurriculumType {
  const norm = text.trim().toUpperCase();

  // 1. Deteksi eksplisit kode kurikulum Al-Wildan
  if (/\b(AE|AL-WILDAN ENGLISH|ENGLISH CLASS)\b/i.test(norm)) return "AE";
  if (/\b(ME|MIDDLE EAST|TIMUR TENGAH)\b/i.test(norm)) return "ME";
  if (/\b(DI|DUAL INTERNATIONAL)\b/i.test(norm)) return "DI";
  if (/\b(MQ|MARKAZ|NASIONAL PLUS|TAHFIDZ)\b/i.test(norm)) return "MQ";
  if (/\b(TK|PRE-SCHOOL|PRESCHOOL|PLAYGROUP|KB|PAUD)\b/i.test(norm)) return "TK";
  if (/\b(INTER|INTERNATIONAL|CAMBRIDGE)\b/i.test(norm)) return "INTER";

  // 2. Fallback berdasarkan jenjang bila ada
  if (gradeLevel) {
    const g = gradeLevel.trim().toUpperCase();
    if (g.startsWith("TK") || g.startsWith("KB") || g.startsWith("PAUD") || g === "0") {
      return "TK";
    }
    const num = parseInt(g, 10);
    if (!isNaN(num) && num >= 7 && num <= 12) {
      return "AE"; // default program internasional SMP/SMA
    }
  }

  return "INTER";
}
export function normalizeCanonicalCurriculum(curriculumType: string): CurriculumType {
  const norm = curriculumType.trim().toUpperCase();
  if (norm === "INTERNATIONAL") return "INTER";
  if (norm === "NATIONAL") return "MQ";
  if (CURRICULUM_TYPES.includes(norm as CurriculumType)) {
    return norm as CurriculumType;
  }
  return "INTER";
}

/**
 * Pemetaan ekspresi SQL SQLite untuk normalisasi kurikulum/program siswa dan paket buku (§0.59).
 * Menyelaraskan variasi penamaan legacy/DB ('INTERNATIONAL' -> 'INTER', 'NATIONAL' -> 'MQ', 'CAMBRIDGE' -> 'INTER', dsb.).
 */
export function sqlNormalizeCurriculum(columnSql: SQL | ReturnType<typeof sql>): SQL {
  return sql`CASE 
    WHEN UPPER(TRIM(${columnSql})) IN ('INTERNATIONAL', 'CAMBRIDGE', 'IB') THEN 'INTER'
    WHEN UPPER(TRIM(${columnSql})) IN ('NATIONAL', 'REGULER', 'DIKNAS') THEN 'MQ'
    ELSE UPPER(TRIM(${columnSql}))
  END`;
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
 * Predikat kanonik untuk mendeteksi apakah judul buku merupakan bagian dari kurikulum Cambridge / Internasional.
 */
export function isCambridgeInternationalTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes("english") ||
    t.includes("prime math") ||
    t.includes("coursebook") ||
    t.includes("science student") ||
    t.includes("science workbook") ||
    t.includes("cambridge") ||
    t.includes("marshall cavendish")
  );
}

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
