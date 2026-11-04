import * as XLSX from "xlsx";
import { resolveBookIsbn } from "./isbn";

export interface ParsedBookRow {
  title: string;
  gradeLevel: string;
  price: number;
  buyPrice?: number;
  isbn?: string;
  subject?: string;
  publisher?: string;
  semester?: "1" | "2" | "all";
  curriculumType?: "international" | "national";
}

export interface SkippedBookRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  reason: string;
}

export interface BookParseResult {
  validBooks: ParsedBookRow[];
  skippedRows: SkippedBookRow[];
  sheetName: string;
}

/**
 * Inferensi otomatis penerbit cerdas berdasarkan judul buku kurikulum Al-Wildan.
 */
export function inferBookPublisher(title: string): string {
  const t = title.toLowerCase();
  if (
    t.includes("english") ||
    t.includes("prime math") ||
    t.includes("coursebook") ||
    t.includes("science student") ||
    t.includes("science workbook") ||
    t.includes("cambridge") ||
    t.includes("marshall cavendish")
  ) {
    return "Cambridge";
  }
  if (
    t.includes("akidah") ||
    t.includes("fikih") ||
    t.includes("ski") ||
    t.includes("sejarah kebudayaan islam") ||
    t.includes("bahasa arab") ||
    t.includes("khat") ||
    t.includes("qc ibadah") ||
    t.includes("tahsin") ||
    t.includes("tahfizh") ||
    t.includes("weekly progress report") ||
    t.includes("wpr") ||
    t.includes("wudhu") ||
    t.includes("qoidah") ||
    t.includes("berdzikir")
  ) {
    return "Al-Wildan Press";
  }
  return "Al-Wildan Press";
}

/**
 * Normalisasi header untuk mencakup variasi newline, spasi, simbol mata uang.
 */
function normalizeHeaderName(val: unknown): string {
  return String(val ?? "")
    .toLowerCase()
    .replace(/\r?\n|\r/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parsing satu sheet tabel katalog buku.
 */
function parseSingleSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  seenKeys: Set<string>,
  skippedRows: SkippedBookRow[],
  validBooks: ParsedBookRow[]
) {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown as unknown[][];

  if (!rawRows || rawRows.length === 0) return;

  // Cek apakah sheet ini adalah sheet rekap/daftar semata tanpa tabel rincian buku
  // Contoh Sheet1 di file Al-Wildan yang hanya berisi ringkasan "SD INTER / MQ"
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = (rawRows[r] || []).map(normalizeHeaderName);
    if (
      row.some((h) =>
        h === "judul" ||
        h === "title" ||
        h === "judul buku" ||
        h === "nama buku" ||
        h.includes("nama buku") ||
        h.includes("judul")
      )
    ) {
      headerRowIndex = r;
      headers = row;
      break;
    }
  }

  // Jika tidak ditemukan baris header nama buku, abaikan sheet ini (misal sheet rekap formula #REF!)
  if (headerRowIndex === -1) {
    if (rawRows.length > 0 && rawRows[0].length >= 2) {
      const topRow = (rawRows[0] || []).map(normalizeHeaderName);
      if (topRow.some((h) => h.includes("nama") || h.includes("judul") || h.includes("buku"))) {
        headerRowIndex = 0;
        headers = topRow;
      } else {
        return;
      }
    } else {
      return;
    }
  }

  // Coba ekstrak konteks kelas & kurikulum dari baris atas (misal "KELAS : 1 INTER")
  let defaultGradeLevel = "1";
  let defaultCurriculum: "international" | "national" = "international";

  const numMatch = sheetName.match(/\d{1,2}/);
  if (numMatch) {
    defaultGradeLevel = numMatch[0];
  }

  for (let r = 0; r < headerRowIndex; r++) {
    const textRow = (rawRows[r] || []).map((c) => String(c ?? "")).join(" ");
    const kMatch = textRow.match(/kelas\s*:?\s*(\d{1,2})/i);
    if (kMatch) {
      defaultGradeLevel = kMatch[1];
    }
    if (/mq|markaz|nasional/i.test(textRow)) {
      defaultCurriculum = "national";
    }
  }

  const titleIdx = headers.findIndex(
    (h) => h === "judul" || h === "title" || h === "judul buku" || h === "nama buku" || h.includes("nama buku")
  );
  const gradeIdx = headers.findIndex(
    (h) => h === "kelas" || h === "grade" || h === "gradelevel" || h === "jenjang"
  );
  const priceIdx = headers.findIndex(
    (h) =>
      h === "harga" ||
      h === "price" ||
      h === "harga jual" ||
      h === "sellprice" ||
      h.includes("harga/unit") ||
      h.includes("harga") ||
      h.includes("biaya buku")
  );
  const buyPriceIdx = headers.findIndex(
    (h) => h === "harga beli" || h === "buyprice" || h === "modal" || h.includes("harga beli")
  );
  const isbnIdx = headers.findIndex((h) => h === "isbn" || h === "barcode");
  const subjIdx = headers.findIndex((h) => h === "mapel" || h === "subject" || h === "mata pelajaran");
  const pubIdx = headers.findIndex((h) => h === "penerbit" || h === "publisher");
  const semIdx = headers.findIndex((h) => h === "semester" || h === "sem" || h === "keterangan");
  const currIdx = headers.findIndex((h) => h === "kurikulum" || h === "curriculum" || h === "curriculumtype");

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const rawObj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) rawObj[h] = row[i];
    });

    const rawTitle = titleIdx !== -1 && row[titleIdx] !== undefined ? String(row[titleIdx]).trim() : "";
    if (!rawTitle) continue;

    // Abaikan jika baris judul adalah baris total atau subheader
    if (/^(total|jumlah|subtotal)\b/i.test(rawTitle)) continue;

    // Kelas / Grade
    let gradeLevel = defaultGradeLevel;
    if (gradeIdx !== -1 && row[gradeIdx] !== undefined && String(row[gradeIdx]).trim() !== "") {
      const gStr = String(row[gradeIdx]).trim();
      const match = gStr.match(/\d{1,2}/);
      if (match) gradeLevel = match[0];
    }

    // Key keunikan judul + kelas
    const dedupeKey = `${rawTitle.toLowerCase()}__${gradeLevel}`;
    if (seenKeys.has(dedupeKey)) {
      skippedRows.push({
        rowNumber: r + 1,
        raw: rawObj,
        reason: `Duplikat judul dan kelas dalam file: ${rawTitle} (Kelas ${gradeLevel})`,
      });
      continue;
    }

    // Harga jual
    let price = 0;
    if (priceIdx !== -1 && row[priceIdx] !== undefined) {
      const cleanNum = String(row[priceIdx]).replace(/[^0-9.]/g, "");
      price = parseFloat(cleanNum) || 0;
    }

    if (price <= 0) {
      skippedRows.push({
        rowNumber: r + 1,
        raw: rawObj,
        reason: `Harga buku tidak boleh Rp 0 atau kosong: ${rawTitle} (Kelas ${gradeLevel})`,
      });
      continue;
    }

    // Harga beli
    let buyPrice: number | undefined;
    if (buyPriceIdx !== -1 && row[buyPriceIdx] !== undefined) {
      const cleanNum = String(row[buyPriceIdx]).replace(/[^0-9.]/g, "");
      buyPrice = parseFloat(cleanNum) || 0;
    }

    const rawIsbn = isbnIdx !== -1 && row[isbnIdx] ? String(row[isbnIdx]).trim() : undefined;
    const isbn = resolveBookIsbn(rawIsbn, undefined, undefined, rawTitle, gradeLevel);
    const subject = subjIdx !== -1 && row[subjIdx] ? String(row[subjIdx]).trim() : "Umum";

    const publisher =
      pubIdx !== -1 && row[pubIdx] && String(row[pubIdx]).trim() !== ""
        ? String(row[pubIdx]).trim()
        : inferBookPublisher(rawTitle);

    // Semester
    let semester: "1" | "2" | "all" = "all";
    if (semIdx !== -1 && row[semIdx]) {
      const sVal = String(row[semIdx]).trim().toUpperCase();
      if (sVal === "1" || sVal.includes("GANJIL") && !sVal.includes("GENAP")) {
        semester = "1";
      } else if (sVal === "2" || sVal.includes("GENAP") && !sVal.includes("GANJIL")) {
        semester = "2";
      }
    }

    // Kurikulum
    let curriculumType: "international" | "national" = defaultCurriculum;
    if (currIdx !== -1 && row[currIdx]) {
      const cVal = String(row[currIdx]).trim().toLowerCase();
      if (cVal.includes("nasional") || cVal.includes("mq") || cVal === "national") {
        curriculumType = "national";
      }
    }

    seenKeys.add(dedupeKey);
    validBooks.push({
      title: rawTitle,
      gradeLevel,
      price,
      buyPrice,
      isbn,
      subject,
      publisher,
      semester,
      curriculumType,
    });
  }
}

/**
 * Parse data katalog buku dari buffer Excel / CSV string.
 * Mendukung pembacaan multi-sheet otomatis (misal sheet 1, 2, 3, 4, 5, 6 per kelas).
 */
export function parseBookCatalogData(fileData: ArrayBuffer | string): BookParseResult {
  const workbook = typeof fileData === "string"
    ? XLSX.read(fileData, { type: "string" })
    : XLSX.read(new Uint8Array(fileData), { type: "array" });

  const validBooks: ParsedBookRow[] = [];
  const skippedRows: SkippedBookRow[] = [];
  const seenKeys = new Set<string>();

  // Bila workbook memiliki banyak sheet (seperti file Al-Wildan dengan sheet '1', '2', dst)
  // kita proses seluruh sheet yang relevan.
  for (const sName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sName];
    if (sheet) {
      parseSingleSheet(sheet, sName, seenKeys, skippedRows, validBooks);
    }
  }

  if (validBooks.length === 0 && skippedRows.length === 0) {
    throw new Error("File katalog tidak memuat data buku yang dapat dibaca.");
  }

  return {
    validBooks,
    skippedRows,
    sheetName: workbook.SheetNames.join(", "),
  };
}

