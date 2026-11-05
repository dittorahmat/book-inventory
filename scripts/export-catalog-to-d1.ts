import * as XLSX from "xlsx";
import { fetchGoogleDriveResource } from "../src/server/services/drive-service";
import { normalizeBookTitle, resolveBookIsbn } from "../src/lib/isbn";
import { inferBookPublisher } from "../src/lib/book-import-parser";
import * as fs from "fs";

interface ExpectedPackage {
  jenjang: "TK" | "SD" | "SMP" | "SMA";
  grade: string;
  curriculum: "TK" | "INTER" | "AE" | "ME" | "DI" | "MQ";
  stream: string;
  price: number;
  intakeType: "baru" | "kenaikan";
}

function parsePackageSummary(pWb: XLSX.WorkBook, sheetName: string, intakeType: "baru" | "kenaikan"): ExpectedPackage[] {
  const ws = pWb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const packages: ExpectedPackage[] = [];
  let currentJenjang = "";
  for (const row of rows) {
    const firstCell = String(row[0] || "").trim();
    if (["TK", "SD", "SMP", "SMA-IPA", "SMA-IPS"].includes(firstCell)) {
      currentJenjang = firstCell;
      continue;
    }
    if (row.some((c) => c === "KELAS" || c === "BIAYA BUKU")) continue;
    if (currentJenjang === "TK" && ["PG", "K-1", "K-2"].includes(firstCell)) {
      const price = Number(row[1]) || 0;
      packages.push({ jenjang: "TK", grade: firstCell, curriculum: "TK", stream: "", price, intakeType });
      continue;
    }
    const gradeNum = Number(firstCell);
    if (!isNaN(gradeNum) && gradeNum > 0) {
      if (currentJenjang === "SD") {
        if (row[1]) packages.push({ jenjang: "SD", grade: String(gradeNum), curriculum: "INTER", stream: "INTER", price: Number(row[1]), intakeType });
        if (row[2]) packages.push({ jenjang: "SD", grade: String(gradeNum), curriculum: "MQ", stream: "MQ", price: Number(row[2]), intakeType });
      } else if (currentJenjang === "SMP") {
        if (row[1]) packages.push({ jenjang: "SMP", grade: String(gradeNum), curriculum: "AE", stream: "AE", price: Number(row[1]), intakeType });
        if (row[2]) packages.push({ jenjang: "SMP", grade: String(gradeNum), curriculum: "ME", stream: "ME", price: Number(row[2]), intakeType });
        if (row[3]) packages.push({ jenjang: "SMP", grade: String(gradeNum), curriculum: "MQ", stream: "MQ", price: Number(row[3]), intakeType });
      } else if (currentJenjang.startsWith("SMA")) {
        const stream = currentJenjang.replace("SMA-", ""); // IPA or IPS
        if (row[1]) packages.push({ jenjang: "SMA", grade: String(gradeNum), curriculum: "AE", stream, price: Number(row[1]), intakeType });
        if (row[2]) packages.push({ jenjang: "SMA", grade: String(gradeNum), curriculum: "DI", stream, price: Number(row[2]), intakeType });
        if (row[3]) packages.push({ jenjang: "SMA", grade: String(gradeNum), curriculum: "ME", stream, price: Number(row[3]), intakeType });
        if (row[4]) packages.push({ jenjang: "SMA", grade: String(gradeNum), curriculum: "MQ", stream, price: Number(row[4]), intakeType });
      }
    }
  }
  return packages;
}

function escapeSql(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  console.log("=== Menyiapkan Ekspor SQL Katalog Buku & Paket ke D1 ===");

  const packageFileId = "1gINL0rtBWbPJ9-Ap8_GQgAOUGPmE9IlnU6CgRa_RjEI";
  const pRes = await fetchGoogleDriveResource(`https://docs.google.com/spreadsheets/d/${packageFileId}`);
  if (!pRes.success || pRes.type !== "sheet") {
    throw new Error("Gagal mengunduh berkas ringkasan paket");
  }
  const pWb = XLSX.read(pRes.data.buffer, { type: "buffer" });
  const allExpected = [
    ...parsePackageSummary(pWb, "PAKET MURID BARU.", "baru"),
    ...parsePackageSummary(pWb, "PAKET KENAIKAN.", "kenaikan"),
  ];

  const folderUrl = "https://drive.google.com/drive/folders/152wjA7d62NmlnRhNAkdR_FNX1igGf4wQ";
  const res = await fetchGoogleDriveResource(folderUrl);
  if (!res.success || res.type !== "folder") {
    throw new Error("Gagal membuka folder Google Drive");
  }

  const files = res.data.files.filter((f) => f.type === "spreadsheet" && f.name.includes("2026-2027") && !f.name.startsWith("A. "));

  const booksMap = new Map<string, {
    id: string;
    isbn: string;
    title: string;
    publicTitle: string;
    author: string;
    publisher: string;
    publishYear: number;
    price: number;
    sellPrice: number;
    buyPrice: number;
    category: string;
    description: string;
    gradeLevel: string;
    curriculumType: string;
  }>();

  const packagesToInsert: Array<{
    id: string;
    code: string;
    name: string;
    gradeLevel: string;
    curriculumType: "TK" | "INTER" | "AE" | "ME" | "DI" | "MQ";
    stream: string | null;
    intakeType: "baru" | "kenaikan";
    academicYear: string;
    price: number;
    description: string;
    items: Array<{ bookId: string; quantity: number }>;
  }> = [];

  const nowIso = new Date().toISOString();

  // Proses setiap paket
  for (const ep of allExpected) {
    const matchingFiles = files.filter((f) => {
      const fn = f.name.toUpperCase();
      const isNew = fn.includes("BARU");
      const isKenaikan = fn.includes("KENAIKAN");
      if (ep.intakeType === "baru" && !isNew) return false;
      if (ep.intakeType === "kenaikan" && !isKenaikan) return false;
      if (!fn.includes(ep.jenjang)) return false;
      if (ep.stream && ep.stream.includes("AE") && !fn.includes("AE")) return false;
      if (ep.stream && ep.stream.includes("ME") && !fn.includes("ME")) return false;
      if (ep.stream && (ep.stream.includes("MQ") || ep.stream.includes("MARKAZ")) && (!fn.includes("MQ") && !fn.includes("MARKAZ"))) return false;
      if (ep.stream && ep.stream.includes("DI") && !fn.includes("DI")) return false;
      if (ep.stream && ep.stream.includes("INTER") && !fn.includes("INTER")) return false;
      return true;
    });

    let foundSheetBooks: Array<{ title: string; price: number }> | null = null;
    let foundSheetName = "";

    for (const f of matchingFiles) {
      const fRes = await fetchGoogleDriveResource(`https://docs.google.com/spreadsheets/d/${f.id}`);
      if (!fRes.success || fRes.type !== "sheet") continue;
      const wb = XLSX.read(fRes.data.buffer, { type: "buffer" });
      for (const s of wb.SheetNames) {
        if (s.toLowerCase().includes("rekap") || s.toLowerCase() === "gabung") continue;
        const ws = wb.Sheets[s];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
        let sum = 0;
        const bList: Array<{ title: string; price: number }> = [];
        for (const r of rows) {
          if (r && typeof r[0] === "number" && r[1] && typeof r[1] === "string" && !/^(total|jumlah|subtotal)\b/i.test(r[1].trim())) {
            let p = 0;
            if (typeof r[2] === "number" && r[2] >= 1000) p = r[2];
            else if (typeof r[3] === "number" && r[3] >= 1000) p = r[3];
            else if (typeof r[4] === "number" && r[4] >= 1000) p = r[4];
            if (p > 0) {
              sum += p;
              bList.push({ title: r[1].trim(), price: p });
            }
          }
        }
        if (sum === ep.price) {
          foundSheetBooks = bList;
          foundSheetName = s;
          break;
        }
      }
      if (foundSheetBooks) break;
    }

    if (!foundSheetBooks) {
      console.warn("PERINGATAN: Paket tidak ditemukan:", ep);
      continue;
    }

    // Kode paket unik yang deskriptif
    const streamCode = ep.stream && ["IPA", "IPS"].includes(ep.stream) ? `-${ep.stream}` : (ep.stream && ep.stream !== ep.curriculum ? `-${ep.stream}` : "");
    const intakeCode = ep.intakeType === "baru" ? "BARU" : "NAIK";
    const packageCode = `PKG-${ep.jenjang}-${ep.grade}-${ep.curriculum}${streamCode}-${intakeCode}-2026-2027`;
    const intakeLabel = ep.intakeType === "baru" ? "Murid Baru/Pindahan" : "Kenaikan Kelas";
    const streamLabel = ep.stream && ["IPA", "IPS"].includes(ep.stream) ? ` (${ep.curriculum} ${ep.stream})` : ` (${ep.curriculum})`;
    const packageName = `Paket Buku ${ep.jenjang} Kelas ${ep.grade}${streamLabel} ${intakeLabel} TA 2026/2027`;

    const packageId = crypto.randomUUID();
    const pkgItems: Array<{ bookId: string; quantity: number }> = [];

    for (const b of foundSheetBooks) {
      const normTitle = normalizeBookTitle(b.title);
      // Buku global diidentifikasi dari judul dan harganya (reusable across packages)
      const bookKey = `${normTitle}__${b.price}`;
      let book = booksMap.get(bookKey);
      if (!book) {
        const bookId = crypto.randomUUID();
        const isbn = resolveBookIsbn(undefined, undefined, undefined, b.title, ep.grade);
        const pub = inferBookPublisher(b.title);
        book = {
          id: bookId,
          isbn,
          title: b.title,
          publicTitle: b.title, // Fallback judul publik sama dengan judul buku
          author: "Tim Al-Wildan",
          publisher: pub,
          publishYear: 2026,
          price: b.price,
          sellPrice: b.price,
          buyPrice: Math.round(b.price * 0.8), // Estimasi modal buku 80%
          category: ep.jenjang,
          description: `Buku pelajaran ${ep.jenjang} TA 2026/2027`,
          gradeLevel: ep.grade,
          curriculumType: ep.curriculum,
        };
        booksMap.set(bookKey, book);
      }
      pkgItems.push({ bookId: book.id, quantity: 1 });
    }

    packagesToInsert.push({
      id: packageId,
      code: packageCode,
      name: packageName,
      gradeLevel: ep.grade,
      curriculumType: ep.curriculum,
      stream: ["IPA", "IPS"].includes(ep.stream) ? ep.stream : null,
      intakeType: ep.intakeType,
      academicYear: "2026/2027",
      price: ep.price,
      description: `Paket resmi Al-Wildan TA 2026/2027 (Sheet: ${foundSheetName})`,
      items: pkgItems,
    });
  }

  console.log(`Buku unik yang akan di-insert: ${booksMap.size}`);
  console.log(`Paket buku yang akan di-insert: ${packagesToInsert.length}`);

  // Susun baris SQL
  const sqlStatements: string[] = [];
  sqlStatements.push("-- Import Katalog Buku & Master Paket Al-Wildan TA 2026/2027");

  // 1. Insert Books (dalam batch INSERT INTO ... VALUES (...) )
  const bookList = Array.from(booksMap.values());
  for (let i = 0; i < bookList.length; i += 10) {
    const chunk = bookList.slice(i, i + 10);
    const rowsSql = chunk.map((b) =>
      `(${escapeSql(b.id)}, ${escapeSql(b.isbn)}, ${escapeSql(b.title)}, ${escapeSql(b.publicTitle)}, ${escapeSql(b.author)}, ${escapeSql(b.publisher)}, ${b.publishYear}, ${escapeSql(b.category)}, ${escapeSql(b.description)}, ${b.price}, ${b.buyPrice}, ${b.sellPrice}, ${escapeSql(nowIso)}, ${escapeSql(nowIso)})`
    ).join(",\n");
    sqlStatements.push(`INSERT INTO books (id, isbn, title, public_title, author, publisher, publish_year, category, description, price, buy_price, sell_price, created_at, updated_at) VALUES\n${rowsSql};`);
  }

  // 2. Insert Packages & Package Items
  for (let i = 0; i < packagesToInsert.length; i += 10) {
    const chunk = packagesToInsert.slice(i, i + 10);
    const rowsSql = chunk.map((p) =>
      `(${escapeSql(p.id)}, ${escapeSql(p.code)}, ${escapeSql(p.name)}, ${escapeSql(p.gradeLevel)}, ${escapeSql(p.curriculumType)}, ${escapeSql(p.stream)}, ${escapeSql(p.intakeType)}, ${escapeSql(p.academicYear)}, ${p.price}, ${escapeSql(p.description)}, ${escapeSql(nowIso)}, ${escapeSql(nowIso)})`
    ).join(",\n");
    sqlStatements.push(`INSERT INTO book_packages (id, code, name, grade_level, curriculum_type, stream, intake_type, academic_year, price, description, created_at, updated_at) VALUES\n${rowsSql};`);
  }

  const allPackageItems: Array<{ id: string; packageId: string; bookId: string; quantity: number }> = [];
  for (const p of packagesToInsert) {
    for (const item of p.items) {
      allPackageItems.push({
        id: crypto.randomUUID(),
        packageId: p.id,
        bookId: item.bookId,
        quantity: item.quantity,
      });
    }
  }

  console.log(`Total BOM (book_package_items) yang akan di-insert: ${allPackageItems.length}`);
  for (let i = 0; i < allPackageItems.length; i += 10) {
    const chunk = allPackageItems.slice(i, i + 10);
    const rowsSql = chunk.map((item) =>
      `(${escapeSql(item.id)}, ${escapeSql(item.packageId)}, ${escapeSql(item.bookId)}, ${item.quantity}, ${escapeSql(nowIso)})`
    ).join(",\n");
    sqlStatements.push(`INSERT INTO book_package_items (id, package_id, book_id, quantity, created_at) VALUES\n${rowsSql};`);
  }

  const outFilePath = "./drizzle/import-catalog-2026-2027.sql";
  fs.writeFileSync(outFilePath, sqlStatements.join("\n\n"), "utf-8");
  console.log(`Berhasil membuat berkas SQL di ${outFilePath} (${sqlStatements.length} statement).`);
}

main().catch((err) => {
  console.error("Gagal menyiapkan ekspor SQL:", err);
  process.exit(1);
});
