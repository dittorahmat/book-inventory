import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { books, bookSuppliers, suppliers } from "../../db/schema";
import { normalizeBookTitle, tokenizeBookTitle } from "../../lib/isbn";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { OFFICIAL_SUPPLIERS } from "../seed-suppliers";

export interface SupplierSummaryItem {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  sheet: string;
  isNew: boolean;
}

export interface SupplierMappingResult {
  suppliersUpserted: number;
  booksMatched: number;
  newLinksCount: number;
  totalSheetsProcessed: number;
  processedSuppliers: SupplierSummaryItem[];
}

export interface SheetVendorConfig {
  sheet: string;
  supCode: string;
  supName: string;
  startRow: number;
  titleCol: number;
  isbnCol?: number | null;
  gradeCol?: number | null;
}

export const DEFAULT_VENDOR_CONFIGS: SheetVendorConfig[] = [
  { sheet: "CNL", supCode: "SUP-CNL", supName: "Chandra Naya Laksana (CNL)", startRow: 10, titleCol: 2, isbnCol: 1 },
  { sheet: "Mentari", supCode: "SUP-MENTARI", supName: "Mentari Books", startRow: 9, titleCol: 2, isbnCol: 1 },
  { sheet: "PELANGI", supCode: "SUP-PELANGI", supName: "Pelangi Books", startRow: 8, titleCol: 1, isbnCol: null, gradeCol: 2 },
  { sheet: "ERLANGGA", supCode: "SUP-ERLANGGA", supName: "Penerbit Erlangga", startRow: 8, titleCol: 4, isbnCol: null, gradeCol: 1 },
  { sheet: "DARSYAFII", supCode: "SUP-DARSYAFII", supName: "Dar Syafii", startRow: 8, titleCol: 2, isbnCol: null },
  { sheet: "BUKU UMUM SURAHMAN", supCode: "SUP-SEGARA", supName: "CV Segara Makmur", startRow: 7, titleCol: 1, isbnCol: null },
  { sheet: "QC & TAHSIN", supCode: "SUP-SEGARA", supName: "CV Segara Makmur", startRow: 7, titleCol: 1, isbnCol: null },
  { sheet: "NAHWU DAN KHAT ABDURRAHMAN", supCode: "SUP-DAKWAH", supName: "Yayasan Dakwah & Taklim", startRow: 7, titleCol: 1, isbnCol: null },
];

export async function importSupplierMappingFromWorkbook(
  database: AppDatabase,
  workbook: XLSX.WorkBook,
  customConfigs: SheetVendorConfig[] = DEFAULT_VENDOR_CONFIGS
): Promise<SupplierMappingResult> {
  const now = new Date().toISOString();

  // 1. Pastikan master supplier ter-upsert HANYA jika sheet-nya ada di workbook
  const supplierCodeToId = new Map<string, string>();
  let suppliersUpserted = 0;

  // Saring hanya config yang sheet-nya benar-benar ada di workbook
  const activeConfigs = customConfigs.filter((cfg) => Boolean(workbook.Sheets[cfg.sheet]));

  // Siapkan map data kontak supplier resmi Al-Wildan
  const officialByCode = new Map(OFFICIAL_SUPPLIERS.map((s) => [s.code, s]));
  officialByCode.set("SUP-ERLANGGA", officialByCode.get("SUP-ERL")!);

  const processedSuppliers: SupplierSummaryItem[] = [];

  for (const cfg of activeConfigs) {
    const official = officialByCode.get(cfg.supCode);
    const resolvedContact = official?.contactPerson ?? null;
    const resolvedPhone = official?.phone ?? null;
    const resolvedAddress = official?.address ?? null;

    if (supplierCodeToId.has(cfg.supCode)) {
      const existingId = supplierCodeToId.get(cfg.supCode)!;
      processedSuppliers.push({
        id: existingId,
        code: cfg.supCode,
        name: cfg.supName,
        contactPerson: resolvedContact,
        phone: resolvedPhone,
        sheet: cfg.sheet,
        isNew: false,
      });
      continue;
    }

    const existing = await database
      .select({
        id: suppliers.id,
        code: suppliers.code,
        name: suppliers.name,
        contactPerson: suppliers.contactPerson,
        phone: suppliers.phone,
      })
      .from(suppliers)
      .where(eq(suppliers.code, cfg.supCode));

    if (existing.length > 0) {
      const cur = existing[0];
      supplierCodeToId.set(cfg.supCode, cur.id);

      // Bila kontak di database masih kosong tetapi ada data resmi, lengkapi datanya
      if ((!cur.contactPerson || !cur.phone) && (resolvedContact || resolvedPhone)) {
        await runWriteBatch(database, [
          database
            .update(suppliers)
            .set({
              contactPerson: cur.contactPerson || resolvedContact,
              phone: cur.phone || resolvedPhone,
              address: resolvedAddress,
              updatedAt: now,
            })
            .where(eq(suppliers.id, cur.id)),
        ]);
      }

      processedSuppliers.push({
        id: cur.id,
        code: cfg.supCode,
        name: cfg.supName,
        contactPerson: cur.contactPerson || resolvedContact,
        phone: cur.phone || resolvedPhone,
        sheet: cfg.sheet,
        isNew: false,
      });
    } else {
      const newId = `sup-${cfg.supCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      await runWriteBatch(database, [
        database.insert(suppliers).values({
          id: newId,
          code: cfg.supCode,
          name: cfg.supName,
          type: "book",
          contactPerson: resolvedContact,
          phone: resolvedPhone,
          address: resolvedAddress,
          createdAt: now,
          updatedAt: now,
        }),
      ]);
      supplierCodeToId.set(cfg.supCode, newId);
      suppliersUpserted++;

      processedSuppliers.push({
        id: newId,
        code: cfg.supCode,
        name: cfg.supName,
        contactPerson: resolvedContact,
        phone: resolvedPhone,
        sheet: cfg.sheet,
        isNew: true,
      });
    }
  }

  // 2. Ambil seluruh buku katalog
  const allBooks = await database
    .select({
      id: books.id,
      isbn: books.isbn,
      title: books.title,
      category: books.category,
    })
    .from(books);

  const byIsbn = new Map<string, (typeof allBooks)[0]>();
  const byNorm = new Map<string, Array<(typeof allBooks)[0]>>();
  const byToken = new Map<string, Array<(typeof allBooks)[0]>>();

  for (const b of allBooks) {
    if (b.isbn) {
      const clean = b.isbn.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
      if (clean) byIsbn.set(clean, b);
    }
    const n = normalizeBookTitle(b.title);
    const nList = byNorm.get(n) ?? [];
    nList.push(b);
    byNorm.set(n, nList);

    const t = tokenizeBookTitle(b.title);
    const tList = byToken.get(t) ?? [];
    tList.push(b);
    byToken.set(t, tList);
  }

  // 3. Ambil relasi yang sudah ada
  const existingLinks = await database
    .select({ bookId: bookSuppliers.bookId, supplierId: bookSuppliers.supplierId })
    .from(bookSuppliers);
  const linkSet = new Set(existingLinks.map((l) => `${l.bookId}:${l.supplierId}`));

  const newLinks: Array<{ bookId: string; supplierId: string; createdAt: string }> = [];
  const matchedBookIds = new Set<string>();
  let sheetsProcessed = 0;

  for (const cfg of activeConfigs) {
    const ws = workbook.Sheets[cfg.sheet];
    if (!ws) continue;
    sheetsProcessed++;

    const supId = supplierCodeToId.get(cfg.supCode);
    if (!supId) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

    for (let r = cfg.startRow; r < rows.length; r++) {
      const row = rows[r] as unknown[];
      if (!row || row.length === 0) continue;

      let matchedBook: (typeof allBooks)[0] | undefined;

      // Prioritas 1: ISBN
      if (cfg.isbnCol !== undefined && cfg.isbnCol !== null && row[cfg.isbnCol] !== undefined) {
        const rawIsbn = String(row[cfg.isbnCol]).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
        if (rawIsbn && byIsbn.has(rawIsbn)) {
          matchedBook = byIsbn.get(rawIsbn);
        }
      }

      // Prioritas 2: Normalized Title + Jenjang Guard
      if (!matchedBook && cfg.titleCol !== null && row[cfg.titleCol]) {
        const rawTitle = String(row[cfg.titleCol]).trim();
        const norm = normalizeBookTitle(rawTitle);
        const candidates = byNorm.get(norm) ?? [];

        if (candidates.length === 1) {
          matchedBook = candidates[0];
        } else if (candidates.length > 1 && cfg.gradeCol !== undefined && cfg.gradeCol !== null && row[cfg.gradeCol]) {
          const rawGrade = String(row[cfg.gradeCol]).trim().toUpperCase();
          // Filter candidate dengan kesesuaian jenjang pada ISBN/category
          const matchedByGrade = candidates.find(
            (c) =>
              (c.isbn && c.isbn.toUpperCase().includes(rawGrade)) ||
              (c.category && c.category.toUpperCase().includes(rawGrade))
          );
          if (matchedByGrade) {
            matchedBook = matchedByGrade;
          }
        }
      }

      // Prioritas 3: Token-Set Match
      if (!matchedBook && cfg.titleCol !== null && row[cfg.titleCol]) {
        const rawTitle = String(row[cfg.titleCol]).trim();
        const tok = tokenizeBookTitle(rawTitle);
        const candidates = byToken.get(tok) ?? [];
        if (candidates.length === 1) {
          matchedBook = candidates[0];
        } else if (candidates.length > 1 && cfg.gradeCol !== undefined && cfg.gradeCol !== null && row[cfg.gradeCol]) {
          const rawGrade = String(row[cfg.gradeCol]).trim().toUpperCase();
          const matchedByGrade = candidates.find(
            (c) =>
              (c.isbn && c.isbn.toUpperCase().includes(rawGrade)) ||
              (c.category && c.category.toUpperCase().includes(rawGrade))
          );
          if (matchedByGrade) {
            matchedBook = matchedByGrade;
          }
        }
      }

      if (matchedBook) {
        matchedBookIds.add(matchedBook.id);
        const linkKey = `${matchedBook.id}:${supId}`;
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey);
          newLinks.push({ bookId: matchedBook.id, supplierId: supId, createdAt: now });
        }
      }
    }
  }

  // 4. Batch insert link baru
  try {
    for (const chunk of chunkRows(newLinks, 10)) {
      await runWriteBatch(database, [database.insert(bookSuppliers).values(chunk)]);
    }
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pemetaan supplier buku");
    throw new Error(mapped?.message || "Gagal menyimpan pemetaan supplier buku.");
  }

  return {
    suppliersUpserted,
    booksMatched: matchedBookIds.size,
    newLinksCount: newLinks.length,
    totalSheetsProcessed: sheetsProcessed,
    processedSuppliers,
  };
}
