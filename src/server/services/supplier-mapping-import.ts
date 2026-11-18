import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { books, bookSuppliers, suppliers } from "../../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { OFFICIAL_SUPPLIERS } from "../seed-suppliers";
import {
  DEFAULT_VENDOR_CONFIGS,
  type SheetVendorConfig,
  type SupplierMappingPreviewResult,
  type SupplierMappingResult,
  type SupplierPreviewSummaryItem,
  type SupplierSummaryItem,
} from "./supplier-mapping-types";
import { buildBookCatalogIndex, matchRowToBook } from "./supplier-mapping-matcher";

export {
  DEFAULT_VENDOR_CONFIGS,
  type SheetVendorConfig,
  type SupplierMappingPreviewResult,
  type SupplierMappingResult,
  type SupplierPreviewSummaryItem,
  type SupplierSummaryItem,
};

export async function importSupplierMappingFromWorkbook(
  database: AppDatabase,
  workbook: XLSX.WorkBook,
  customConfigs: SheetVendorConfig[] = DEFAULT_VENDOR_CONFIGS
): Promise<SupplierMappingResult> {
  const now = new Date().toISOString();
  const supplierCodeToId = new Map<string, string>();
  let suppliersUpserted = 0;

  const activeConfigs = customConfigs.filter((cfg) => Boolean(workbook.Sheets[cfg.sheet]));
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

  const allBooks = await database
    .select({
      id: books.id,
      isbn: books.isbn,
      title: books.title,
      category: books.category,
    })
    .from(books);
  const catalogIndex = buildBookCatalogIndex(allBooks);

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

      const matchedBook = matchRowToBook(row, cfg, catalogIndex);
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

export async function previewSupplierMappingFromWorkbook(
  database: AppDatabase,
  workbook: XLSX.WorkBook,
  customConfigs: SheetVendorConfig[] = DEFAULT_VENDOR_CONFIGS
): Promise<SupplierMappingPreviewResult> {
  const activeConfigs = customConfigs.filter((cfg) => Boolean(workbook.Sheets[cfg.sheet]));
  const officialByCode = new Map(OFFICIAL_SUPPLIERS.map((s) => [s.code, s]));
  officialByCode.set("SUP-ERLANGGA", officialByCode.get("SUP-ERL")!);

  const existingSuppliers = await database
    .select({
      id: suppliers.id,
      code: suppliers.code,
      name: suppliers.name,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
    })
    .from(suppliers);
  const existingByCode = new Map(existingSuppliers.map((s) => [s.code, s]));

  const allBooks = await database
    .select({
      id: books.id,
      isbn: books.isbn,
      title: books.title,
      category: books.category,
    })
    .from(books);
  const catalogIndex = buildBookCatalogIndex(allBooks);

  const supplierSummaries: SupplierPreviewSummaryItem[] = [];
  const totalMatchedBookIds = new Set<string>();

  for (const cfg of activeConfigs) {
    const ws = workbook.Sheets[cfg.sheet];
    if (!ws) continue;

    const existing = existingByCode.get(cfg.supCode);
    const official = officialByCode.get(cfg.supCode);
    const resolvedContact = existing?.contactPerson || official?.contactPerson || null;
    const resolvedPhone = existing?.phone || official?.phone || null;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const sheetMatchedBookIds = new Set<string>();
    const sampleBooks: string[] = [];

    for (let r = cfg.startRow; r < rows.length; r++) {
      const row = rows[r] as unknown[];
      if (!row || row.length === 0) continue;

      const matchedBook = matchRowToBook(row, cfg, catalogIndex);
      if (matchedBook) {
        sheetMatchedBookIds.add(matchedBook.id);
        totalMatchedBookIds.add(matchedBook.id);
        if (sampleBooks.length < 3 && !sampleBooks.includes(matchedBook.title)) {
          sampleBooks.push(matchedBook.title);
        }
      }
    }

    supplierSummaries.push({
      id: existing?.id || `sup-${cfg.supCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      code: cfg.supCode,
      name: cfg.supName,
      contactPerson: resolvedContact,
      phone: resolvedPhone,
      sheet: cfg.sheet,
      isNew: !existing,
      booksMatchedCount: sheetMatchedBookIds.size,
      sampleBooks,
    });
  }

  return {
    totalSheetsFound: Object.keys(workbook.Sheets).length,
    totalSheetsProcessed: activeConfigs.length,
    totalBooksMatched: totalMatchedBookIds.size,
    suppliers: supplierSummaries,
  };
}
