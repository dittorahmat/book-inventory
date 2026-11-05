import * as XLSX from "xlsx";
import { determineIntakeType } from "./curriculum";

export interface ParsedStudentRow {
  nis: string;
  name: string;
  gradeLevel: string;
  gender: "male" | "female";
  curriculumType: "TK" | "INTER" | "AE" | "ME" | "DI" | "MQ" | "international" | "national";
  stream?: "IPA" | "IPS";
  intakeType?: "baru" | "kenaikan";
  academicYear: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
}

export interface SkippedStudentRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  reason: string;
}

export interface StudentParseResult {
  validStudents: ParsedStudentRow[];
  skippedRows: SkippedStudentRow[];
  sheetName: string;
  totalRawRows: number;
}

/**
 * Normalisasi string kelas Al-Wildan seperti "1.INTER 1", "2.MQ 2", "3 INTER 4", "10-AE IPA", "Kelas 5", dll.
 */
export function normalizeAlWildanClass(classStr: string): {
  gradeLevel: string | null;
  curriculumType: "TK" | "INTER" | "AE" | "ME" | "DI" | "MQ";
  stream?: "IPA" | "IPS";
} {
  const trimmed = classStr.trim().toUpperCase();

  // Cek kasus cuti / non-aktif
  if (trimmed === "CUTI" || trimmed.includes("CUTI") || trimmed === "ALUMNI" || trimmed === "PINDAH") {
    return { gradeLevel: null, curriculumType: "INTER" };
  }

  // Cek jenjang TK (PG, K-1, K-2)
  if (/^(PG|PLAYGROUP)/i.test(trimmed)) {
    return { gradeLevel: "PG", curriculumType: "TK" };
  }
  if (/^K-?1/i.test(trimmed)) {
    return { gradeLevel: "K-1", curriculumType: "TK" };
  }
  if (/^K-?2/i.test(trimmed)) {
    return { gradeLevel: "K-2", curriculumType: "TK" };
  }

  // Cari angka jenjang (1-12)
  const match = trimmed.match(/(?:^|\b|[A-Z]*)(\d{1,2})(?:\.|\s|-|$)/);
  if (!match) {
    return { gradeLevel: null, curriculumType: "INTER" };
  }

  const gradeLevel = match[1];

  // Deteksi jurusan SMA (IPA vs IPS)
  let stream: "IPA" | "IPS" | undefined;
  if (trimmed.includes("IPA")) stream = "IPA";
  else if (trimmed.includes("IPS")) stream = "IPS";

  // Deteksi program kurikulum
  let curriculumType: "TK" | "INTER" | "AE" | "ME" | "DI" | "MQ" = "INTER";
  if (trimmed.includes("AE")) {
    curriculumType = "AE";
  } else if (trimmed.includes("ME")) {
    curriculumType = "ME";
  } else if (trimmed.includes("DI")) {
    curriculumType = "DI";
  } else if (trimmed.includes("MQ") || trimmed.includes("MARKAZ")) {
    curriculumType = "MQ";
  } else if (trimmed.includes("INTER") || trimmed.includes("SD")) {
    curriculumType = "INTER";
  }

  return { gradeLevel, curriculumType, stream };
}

export { normalizeGoogleSheetsUrl } from "./sheets";

/**
 * Parse data siswa dari ArrayBuffer / binary Excel (.xlsx/.xlsm) atau string CSV.
 */
export function parseStudentData(
  fileData: ArrayBuffer | string,
  defaultAcademicYear: string = "2026/2027"
): StudentParseResult {
  const workbook = typeof fileData === "string"
    ? XLSX.read(fileData, { type: "string" })
    : XLSX.read(new Uint8Array(fileData), { type: "array" });

  // Prioritaskan sheet DT-SSW bila ada (standar format sekolah)
  let sheetName = workbook.SheetNames[0];
  if (workbook.SheetNames.includes("DT-SSW")) {
    sheetName = "DT-SSW";
  } else {
    // Cari sheet yang namanya mirip dengan student/siswa
    const found = workbook.SheetNames.find((s) => /siswa|student|dt-ssw|data/i.test(s));
    if (found) sheetName = found;
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} tidak ditemukan dalam file.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1, // Array of arrays
    defval: "",
    blankrows: false,
  }) as unknown as unknown[][];

  if (!rawRows || rawRows.length === 0) {
    throw new Error("File tidak memuat baris data yang dapat dibaca.");
  }

  // Temukan baris header: baris yang memuat 'nis' dan salah satu dari 'nama' / 'name'
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = (rawRows[r] || []).map((c) => String(c ?? "").trim().toLowerCase());
    const hasNis = row.some((h) => h === "nis" || h.includes("nomor induk") || h === "student id");
    const hasName = row.some((h) => h === "nama" || h === "name" || h === "nama siswa" || h === "nama peserta didik");
    if (hasNis && hasName) {
      headerRowIndex = r;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    // Fallback: anggap baris 0 adalah header jika mengandung minimal 2 kolom
    if (rawRows.length > 0 && rawRows[0].length >= 2) {
      headerRowIndex = 0;
      headers = (rawRows[0] || []).map((c) => String(c ?? "").trim().toLowerCase());
    } else {
      throw new Error("Header data tidak ditemukan. Pastikan berkas memiliki kolom 'NIS' dan 'Nama'.");
    }
  }

  // Pemetaan indeks kolom
  const nisIdx = headers.findIndex((h) => h === "nis" || h.includes("nomor induk") || h === "student id");
  const nameIdx = headers.findIndex((h) => h === "nama" || h === "name" || h === "nama siswa" || h === "nama peserta didik");
  const classIdx = headers.findIndex((h) => h === "kelas" || h === "class" || h === "gradelevel" || h === "tingkat");
  const genderIdx = headers.findIndex((h) => h === "jk" || h === "gender" || h === "jenis kelamin" || h === "m/f");
  const currIdx = headers.findIndex((h) => h === "curriculumtype" || h === "kurikulum");
  const yearIdx = headers.findIndex((h) => h === "academicyear" || h === "tahun ajaran" || h === "tp");
  const pNameIdx = headers.findIndex((h) => h === "parentname" || h === "nama orang tua" || h === "wali");
  const pPhoneIdx = headers.findIndex((h) => h === "parentphone" || h === "telepon" || h === "no telp" || h === "whatsapp" || h === "no wa");
  const pEmailIdx = headers.findIndex((h) => h === "parentemail" || h === "email");

  const validStudents: ParsedStudentRow[] = [];
  const skippedRows: SkippedStudentRow[] = [];
  const seenNis = new Set<string>();

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const rawObj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) rawObj[h] = row[i];
    });

    const rawNis = nisIdx !== -1 && row[nisIdx] !== undefined ? String(row[nisIdx]).trim() : "";
    const rawName = nameIdx !== -1 && row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : "";
    const rawClass = classIdx !== -1 && row[classIdx] !== undefined ? String(row[classIdx]).trim() : "";

    // Lewati jika seluruh baris kosong
    if (!rawNis && !rawName && !rawClass) {
      continue;
    }

    if (!rawNis) {
      skippedRows.push({
        rowNumber: r + 1,
        raw: rawObj,
        reason: "NIS kosong atau tidak valid",
      });
      continue;
    }

    if (!rawName) {
      skippedRows.push({
        rowNumber: r + 1,
        raw: rawObj,
        reason: "Nama siswa kosong",
      });
      continue;
    }

    if (seenNis.has(rawNis)) {
      skippedRows.push({
        rowNumber: r + 1,
        raw: rawObj,
        reason: `Duplikat NIS dalam file: ${rawNis}`,
      });
      continue;
    }

    const { gradeLevel, curriculumType: autoCurriculum, stream } = normalizeAlWildanClass(rawClass);

    if (!gradeLevel) {
      skippedRows.push({
        rowNumber: r + 1,
        raw: rawObj,
        reason: `Jenjang kelas tidak valid atau murid berstatus khusus (${rawClass || "tanpa kelas"})`,
      });
      continue;
    }

    // Tentukan gender
    let gender: "male" | "female" = "male";
    if (genderIdx !== -1 && row[genderIdx]) {
      const gStr = String(row[genderIdx]).trim().toLowerCase();
      if (gStr === "female" || gStr === "p" || gStr === "perempuan" || gStr === "f") {
        gender = "female";
      }
    }

    // Tentukan curriculum
    let curriculumType = autoCurriculum;
    if (currIdx !== -1 && row[currIdx]) {
      const cStr = String(row[currIdx]).trim().toUpperCase();
      if (["TK", "INTER", "AE", "ME", "DI", "MQ"].includes(cStr)) {
        curriculumType = cStr as typeof curriculumType;
      }
    }

    // Academic Year
    const academicYear = yearIdx !== -1 && row[yearIdx]
      ? String(row[yearIdx]).trim()
      : defaultAcademicYear;

    // Tentukan intakeType: berdasarkan 4 digit prefix NIS terhadap tahun ajaran aktif
    const intakeType: "baru" | "kenaikan" = determineIntakeType(rawNis, academicYear);

    const parentName = pNameIdx !== -1 && row[pNameIdx] ? String(row[pNameIdx]).trim() : undefined;
    const parentPhone = pPhoneIdx !== -1 && row[pPhoneIdx] ? String(row[pPhoneIdx]).trim() : undefined;
    const parentEmail = pEmailIdx !== -1 && row[pEmailIdx] ? String(row[pEmailIdx]).trim() : undefined;

    seenNis.add(rawNis);
    validStudents.push({
      nis: rawNis,
      name: rawName,
      gradeLevel,
      gender,
      curriculumType,
      stream,
      intakeType,
      academicYear,
      parentName,
      parentPhone,
      parentEmail,
    });
  }

  return {
    validStudents,
    skippedRows,
    sheetName,
    totalRawRows: rawRows.length - (headerRowIndex + 1),
  };
}
