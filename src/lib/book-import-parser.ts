import * as XLSX from "xlsx";
import { resolveBookIsbn } from "./isbn";
import {
  isCambridgeInternationalTitle,
  inferCurriculumFromText,
  type CurriculumType,
} from "./curriculum";

export interface ParsedBookRow {
  title: string;
  gradeLevel: string;
  price: number;
  buyPrice?: number;
  isbn?: string;
  subject?: string;
  publisher?: string;
  semester?: "1" | "2" | "all";
  curriculumType?: CurriculumType;
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
  if (isCambridgeInternationalTitle(title)) {
    return "Cambridge";
  }
  const t = title.toLowerCase();
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

  // Cek apakah baris ini adalah header baru dalam sheet (multi-tabel)
  function isHeaderRow(rowCells: unknown[]): boolean {
    const rowNorm = rowCells.map(normalizeHeaderName);
    return rowNorm.some(
      (h) =>
        h === "judul" ||
        h === "title" ||
        h === "judul buku" ||
        h === "nama buku" ||
        h.includes("nama buku") ||
        (h.includes("judul") && !h.includes("keterangan"))
    );
  }

  for (let r = 0; r < rawRows.length; r++) {
    if (isHeaderRow(rawRows[r] || [])) {
      headerRowIndex = r;
      headers = (rawRows[r] || []).map(normalizeHeaderName);
      break;
    }
  }

  // Jika tidak ditemukan baris header nama buku, coba cek baris paling atas
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
  let defaultCurriculum: CurriculumType = "INTER";

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
    const detected = inferCurriculumFromText(textRow, defaultGradeLevel);
    if (detected !== "INTER" || /inter/i.test(textRow)) {
      defaultCurriculum = detected;
    }
  }

  function resolveColumnIndices(hList: string[]) {
    return {
      titleIdx: hList.findIndex(
        (h) => h === "judul" || h === "title" || h === "judul buku" || h === "nama buku" || h.includes("nama buku")
      ),
      gradeIdx: hList.findIndex(
        (h) => h === "kelas" || h === "grade" || h === "gradelevel" || h === "jenjang"
      ),
      priceIdx: hList.findIndex(
        (h) =>
          h === "harga" ||
          h === "price" ||
          h === "harga jual" ||
          h === "sellprice" ||
          h.includes("harga/unit") ||
          h.includes("harga") ||
          h.includes("biaya buku")
      ),
      buyPriceIdx: hList.findIndex(
        (h) => h === "harga beli" || h === "buyprice" || h === "modal" || h.includes("harga beli")
      ),
      isbnIdx: hList.findIndex((h) => h === "isbn" || h === "barcode"),
      subjIdx: hList.findIndex((h) => h === "mapel" || h === "subject" || h === "mata pelajaran"),
      pubIdx: hList.findIndex((h) => h === "penerbit" || h === "publisher"),
      semIdx: hList.findIndex((h) => h === "semester" || h === "sem" || h === "keterangan"),
      currIdx: hList.findIndex((h) => h === "kurikulum" || h === "curriculum" || h === "curriculumtype"),
    };
  }

  let colIndices = resolveColumnIndices(headers);

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];

    // Deteksi sub-header baru di tengah sheet (misal tabel kedua)
    if (isHeaderRow(row)) {
      headers = row.map(normalizeHeaderName);
      colIndices = resolveColumnIndices(headers);
      continue;
    }

    const rawObj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) rawObj[h] = row[i];
    });

    const { titleIdx, gradeIdx, priceIdx, buyPriceIdx, isbnIdx, subjIdx, pubIdx, semIdx, currIdx } = colIndices;
    const rawTitle = titleIdx !== -1 && row[titleIdx] !== undefined ? String(row[titleIdx]).trim() : "";
    if (!rawTitle) continue;

    // Abaikan jika baris judul adalah baris total, subheader, atau catatan
    if (/^(total|jumlah|subtotal|catatan|keterangan|program weekly)\b/i.test(rawTitle)) continue;
    if (rawTitle.toLowerCase().includes("wajib untuk semua murid")) continue;

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
    const isbn = resolveBookIsbn(rawIsbn, undefined, undefined, rawTitle, gradeLevel, price);
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

    // Kurikulum: Jika judul memuat mata pelajaran Cambridge / Internasional, prioritaskan 'INTER'
    let curriculumType: CurriculumType = defaultCurriculum;
    if (currIdx !== -1 && row[currIdx]) {
      curriculumType = inferCurriculumFromText(String(row[currIdx]), gradeLevel);
    } else if (isCambridgeInternationalTitle(rawTitle)) {
      const gNum = parseInt(gradeLevel, 10);
      // Untuk SMP/SMA (7-12), Cambridge mapel masuk ke AE (Al-Wildan English) kecuali ditentukan lain
      curriculumType = !isNaN(gNum) && gNum >= 7 ? "AE" : "INTER";
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

