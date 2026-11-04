import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { requireScopedActor, accessErrorResponse } from "../services/access-scope";
import { idSchema } from "../lib/validators";
import { importBookCatalog } from "../services/book-catalog-import";

export const bookBulkRouter = new Hono();

const bookImportItemSchema = z.object({
  id: idSchema.optional(),
  title: z.string().min(1, "Judul buku wajib diisi"),
  author: z.string().optional().default("Tim Al-Wildan"),
  publisher: z.string().optional().default("Penerbit Al-Wildan"),
  publishYear: z.number().int().optional().default(new Date().getFullYear()),
  category: z.string().optional(),
  description: z.string().optional(),
  price: z.number().nonnegative().default(0),
  buyPrice: z.number().nonnegative().optional(),
  sellPrice: z.number().nonnegative().optional(),
  isbn: z.string().optional(),
});

const bulkImportBooksPayloadSchema = z.object({
  books: z.array(bookImportItemSchema).min(1, "Minimal 1 data buku untuk diimpor"),
});

bookBulkRouter.post("/bulk-import", zValidator("json", bulkImportBooksPayloadSchema), async (c) => {
  try {
    const { actor } = await requireScopedActor(db, c);
    if (actor.role !== "central_admin" && actor.role !== "warehouse_books_admin" && actor.role !== "warehouse_admin") {
      return c.json({ success: false, message: "Akses ditolak: Hanya admin pusat/gudang yang dapat mengimpor katalog buku." }, 403);
    }

    const body = c.req.valid("json");
    const result = await importBookCatalog(db, body.books);

    return c.json({
      success: true,
      message: `Impor katalog buku berhasil: ${result.insertedCount} judul baru ditambahkan, ${result.updatedCount} judul diperbarui.`,
      data: result,
    });
  } catch (err: unknown) {
    return accessErrorResponse(c, err);
  }
});
