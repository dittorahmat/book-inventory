import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { requireScopedActor, accessErrorResponse } from "../services/access-scope";
import { idSchema } from "../lib/validators";
import { importBookCatalog } from "../services/book-catalog-import";
import {
  isGoogleDriveFolderUrl,
  normalizeGoogleSheetsUrl,
  parseGoogleDriveFolderHtml,
} from "../../lib/sheets";
import { parseBookCatalogData } from "../../lib/book-import-parser";

export const bookBulkRouter = new Hono();

const bookImportItemSchema = z
  .object({
    id: idSchema.optional(),
    title: z.string().min(1, "Judul buku wajib diisi"),
    author: z.string().optional().default("Tim Al-Wildan"),
    publisher: z.string().optional().default("Penerbit Al-Wildan"),
    publishYear: z.number().int().optional().default(new Date().getFullYear()),
    category: z.string().optional(),
    description: z.string().optional(),
    subject: z.string().optional(),
    price: z.number().nonnegative().default(0),

    buyPrice: z.number().nonnegative().optional(),
    sellPrice: z.number().nonnegative().optional(),
    isbn: z.string().optional(),
    gradeLevel: z.string().optional(),
    curriculumType: z.enum(["international", "national"]).optional(),
    academicYear: z.string().optional(),
  })
  .strict();

const bulkImportBooksPayloadSchema = z
  .object({
    books: z.array(bookImportItemSchema).min(1, "Minimal 1 data buku untuk diimpor"),
    autoCreatePackages: z.boolean().optional().default(false),
    academicYear: z.string().optional().default("2026/2027"),
  })
  .strict();

const parseDriveUrlPayloadSchema = z
  .object({
    url: z.string().url("URL tidak valid"),
  })
  .strict();


/**
 * Endpoint server-side untuk parsing Google Drive Folder atau Google Sheets URL.
 * Mencegah issue CORS browser dan mendukung ekstraksi file spreadsheet otomatis dari link folder Google Drive.
 */
bookBulkRouter.post("/parse-drive-url", zValidator("json", parseDriveUrlPayloadSchema), async (c) => {
  try {
    const { actor } = await requireScopedActor(db, c);
    if (actor.role !== "central_admin" && actor.role !== "warehouse_books_admin" && actor.role !== "warehouse_admin") {
      return c.json({ success: false, message: "Akses ditolak." }, 403);
    }

    const { url } = c.req.valid("json");

    // Kasus 1: URL adalah Google Drive Folder
    if (isGoogleDriveFolderUrl(url)) {
      const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!resp.ok) {
        return c.json({ success: false, message: "Gagal mengakses folder Google Drive. Pastikan izin diatur publik (Anyone with link)." }, 400);
      }
      const html = await resp.text();
      const files = parseGoogleDriveFolderHtml(html);
      return c.json({
        success: true,
        type: "folder",
        data: {
          files,
          totalFiles: files.length,
        },
      });
    }

    // Kasus 2: URL adalah Google Sheets langsung
    const exportUrl = normalizeGoogleSheetsUrl(url);
    if (exportUrl) {
      const resp = await fetch(exportUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!resp.ok) {
        return c.json({ success: false, message: "Gagal mengunduh Google Sheets. Pastikan akses diatur publik." }, 400);
      }
      const csvText = await resp.text();
      const parseResult = parseBookCatalogData(csvText);
      return c.json({
        success: true,
        type: "sheet",
        data: parseResult,
      });
    }

    return c.json({ success: false, message: "URL bukan Google Sheets maupun Google Drive Folder yang valid." }, 400);
  } catch (err: unknown) {
    return accessErrorResponse(c, err);
  }
});

bookBulkRouter.post("/bulk-import", zValidator("json", bulkImportBooksPayloadSchema), async (c) => {
  try {
    const { actor } = await requireScopedActor(db, c);
    if (actor.role !== "central_admin" && actor.role !== "warehouse_books_admin" && actor.role !== "warehouse_admin") {
      return c.json({ success: false, message: "Akses ditolak: Hanya admin pusat/gudang yang dapat mengimpor katalog buku." }, 403);
    }

    const body = c.req.valid("json");
    const result = await importBookCatalog(db, body.books, {
      autoCreatePackages: body.autoCreatePackages,
      academicYear: body.academicYear,
    });

    const packageMsg = result.packagesCreatedCount > 0 ? `, dan ${result.packagesCreatedCount} paket bundling dibuat` : "";

    return c.json({
      success: true,
      message: `Impor katalog buku berhasil: ${result.insertedCount} judul baru ditambahkan, ${result.updatedCount} judul diperbarui${packageMsg}.`,
      data: result,
    });
  } catch (err: unknown) {
    return accessErrorResponse(c, err);
  }
});


