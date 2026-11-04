import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { books } from "../../db/schema";
import { requireScopedActor, accessErrorResponse } from "../services/access-scope";
import { idSchema } from "../lib/validators";
import { resolveBookIsbn } from "../../lib/isbn";

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
    const items = body.books;

    let insertedCount = 0;
    let updatedCount = 0;
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const isbn = resolveBookIsbn(item.isbn);
      const [existingBook] = await db
        .select({ id: books.id })
        .from(books)
        .where(eq(books.isbn, isbn));

      const effectivePrice = Math.round(item.sellPrice ?? item.price ?? 0);
      const effectiveBuyPrice = Math.round(item.buyPrice ?? item.price ?? 0);

      if (existingBook) {
        await db
          .update(books)
          .set({
            title: item.title,
            author: item.author || "Tim Al-Wildan",
            publisher: item.publisher || "Penerbit Al-Wildan",
            publishYear: item.publishYear,
            category: item.category || null,
            description: item.description || null,
            price: effectivePrice,
            sellPrice: effectivePrice,
            buyPrice: effectiveBuyPrice,
            updatedAt: nowIso,
          })
          .where(eq(books.id, existingBook.id));
        updatedCount++;
      } else {
        const newId = item.id || crypto.randomUUID();
        await db.insert(books).values({
          id: newId,
          isbn,
          title: item.title,
          author: item.author || "Tim Al-Wildan",
          publisher: item.publisher || "Penerbit Al-Wildan",
          publishYear: item.publishYear,
          category: item.category || null,
          description: item.description || null,
          price: effectivePrice,
          sellPrice: effectivePrice,
          buyPrice: effectiveBuyPrice,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        insertedCount++;
      }
    }

    return c.json({
      success: true,
      message: `Impor katalog buku berhasil: ${insertedCount} judul baru ditambahkan, ${updatedCount} judul diperbarui.`,
      data: {
        insertedCount,
        updatedCount,
        total: items.length,
      },
    });
  } catch (err: unknown) {
    return accessErrorResponse(c, err);
  }
});
