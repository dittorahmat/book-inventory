import * as XLSX from "xlsx";

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
 * Parse data katalog buku dari buffer Excel / CSV string.
 */
export function parseBookCatalogData(fileData: ArrayBuffer | string): BookParseResult {
  const workbook = typeof fileData === "string"
    ? XLSX.read(fileData, { type: "string" })
    : XLSX.read(new Uint8Array(fileData), { type: "array" });

  let sheetName = workbook.SheetNames[0];
  const foundSheet = workbook.SheetNames.find((s) => /buku|book|katalog|catalog/i.test(s));
  if (foundSheet) sheetName = foundSheet;

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} tidak ditemukan dalam file.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown as unknown[][];

  if (!rawRows || rawRows.length === 0) {
    throw new Error("File katalog tidak memuat data yang dapat dibaca.");
  }

  // Cari baris header yang memuat 'judul' / 'title'
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = (rawRows[r] || []).map((c) => String(c ?? "").trim().toLowerCase());
    if (row.some((h) => h === "judul" || h === "title" || h === "judul buku" || h === "nama buku")) {
      headerRowIndex = r;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    if (rawRows.length > 0 && rawRows[0].length >= 2) {
      headerRowIndex = 0;
      headers = (rawRows[0] || []).map((c) => String(c ?? "").trim().toLowerCase());
    } else {
      throw new Error("Header katalog buku wajib memiliki kolom 'Judul' / 'Title'.");
    }
  }

  const titleIdx = headers.findIndex((h) => h === "judul" || h === "title" || h === "judul buku" || h === "nama buku");
  const gradeIdx = headers.findIndex((h) => h === "kelas" || h === "grade" || h === "gradelevel" || h === "jenjang");
  const priceIdx = headers.findIndex((h) => h === "harga" || h === "price" || h === "harga jual" || h === "sellprice");
  const buyPriceIdx = headers.findIndex((h) => h === "harga beli" || h === "buyprice" || h === "modal");
  const isbnIdx = headers.findIndex((h) => h === "isbn" || h === "barcode");
  const subjIdx = headers.findIndex((h) => h === "mapel" || h === "subject" || h === "mata pelajaran");
  const pubIdx = headers.findIndex((h) => h === "penerbit" || h === "publisher");
  const semIdx = headers.findIndex((h) => h === "semester" || h === "sem");
  const currIdx = headers.findIndex((h) => h === "kurikulum" || h === "curriculum" || h === "curriculumtype");

  const validBooks: ParsedBookRow[] = [];
  const skippedRows: SkippedBookRow[] = [];
  const seenKeys = new Set<string>();

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const rawObj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) rawObj[h] = row[i];
    });

    const rawTitle = titleIdx !== -1 && row[titleIdx] !== undefined ? String(row[titleIdx]).trim() : "";
    if (!rawTitle) continue;

    // Kelas / Grade
    let gradeLevel = "1";
    if (gradeIdx !== -1 && row[gradeIdx] !== undefined) {
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

    // Harga beli
    let buyPrice: number | undefined;
    if (buyPriceIdx !== -1 && row[buyPriceIdx] !== undefined) {
      const cleanNum = String(row[buyPriceIdx]).replace(/[^0-9.]/g, "");
      buyPrice = parseFloat(cleanNum) || 0;
    }

    const isbn = isbnIdx !== -1 && row[isbnIdx] ? String(row[isbnIdx]).trim() : undefined;
    const subject = subjIdx !== -1 && row[subjIdx] ? String(row[subjIdx]).trim() : "Umum";
    const publisher = pubIdx !== -1 && row[pubIdx] ? String(row[pubIdx]).trim() : undefined;

    // Semester
    let semester: "1" | "2" | "all" = "all";
    if (semIdx !== -1 && row[semIdx]) {
      const sVal = String(row[semIdx]).trim();
      if (sVal === "1" || sVal === "2") semester = sVal;
    }

    // Kurikulum
    let curriculumType: "international" | "national" = "international";
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

  return {
    validBooks,
    skippedRows,
    sheetName,
  };
}
