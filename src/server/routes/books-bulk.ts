import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { requireScopedActor, accessErrorResponse } from "../services/access-scope";
import { idSchema } from "../lib/validators";
import { importBookCatalog } from "../services/book-catalog-import";
import { parseBookCatalogData } from "../../lib/book-import-parser";
import { fetchGoogleDriveResource } from "../services/drive-service";

export const bookBulkRouter = new Hono();


const bookImportItemSchema = z
  .object({
    id: idSchema.optional(),
    title: z.string().min(1, "Judul buku wajib diisi"),
    author: z.string().optional().default("Tim Al-Wildan"),
    publisher: z.string().optional().default("Al-Wildan Press"),
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
    const res = await fetchGoogleDriveResource(url);

    if (!res.success) {
      return c.json({ success: false, message: res.message }, res.status);
    }

    if (res.type === "folder") {
      return c.json({
        success: true,
        type: "folder",
        data: res.data,
      });
    }

    const parseResult = parseBookCatalogData(res.data.csvText);
    return c.json({
      success: true,
      type: "sheet",
      data: parseResult,
    });
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


