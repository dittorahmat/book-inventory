import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { books, bookSuppliers, suppliers } from "../../db/schema";
import { idSchema } from "../lib/validators";
import { defaultStorage } from "../../services/storage";
import {
  effectiveBuyPrice,
  effectiveSellPrice,
} from "../../lib/book-pricing";
import { recalcPackagesUsingBook } from "../services/book-price";
import {
  accessErrorResponse,
  resolveLogisticsActor,
} from "../services/access-scope";
import { chunkRows, runWriteBatch } from "../lib/d1-write";

/** Tulis ulang relasi Book–supplier secara atomik (chunk ≤10, sekuensial di D1). */
async function replaceBookSuppliers(database: typeof db, bookId: string, supplierIds: string[], now: string) {
  const uniq = [...new Set(supplierIds)];
  if (uniq.length > 0) {
    const known: Array<{ id: string }> = await database
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(inArray(suppliers.id, uniq));
    const missing = uniq.filter((id: string) => !known.some((k: { id: string }) => k.id === id));
    if (missing.length > 0) throw new Error(`Supplier tidak ditemukan: ${missing[0]}`);
  }
  await database.delete(bookSuppliers).where(eq(bookSuppliers.bookId, bookId));
  const rows = uniq.map((supplierId) => ({ bookId, supplierId, createdAt: now }));
  for (const chunk of chunkRows(rows)) {
    await runWriteBatch(database, [database.insert(bookSuppliers).values(chunk)]);
  }
}

const supplierIdsOf = async (database: typeof db, bookId: string): Promise<string[]> =>
  (
    (await database
      .select({ supplierId: bookSuppliers.supplierId })
      .from(bookSuppliers)
      .where(eq(bookSuppliers.bookId, bookId))) as Array<{ supplierId: string }>
  ).map((r: { supplierId: string }) => r.supplierId);

const withSuppliers = async <T extends { id: string }>(database: typeof db, book: T): Promise<T & { supplierIds: string[] }> => ({
  ...book,
  supplierIds: await supplierIdsOf(database, book.id),
});

export const booksRouter = new Hono();

const createBookSchema = z.object({
  isbn: z.string().min(10, "Valid ISBN required"),
  title: z.string().min(1, "Title is required"),
  publicTitle: z.string().optional(),
  supplierIds: z.array(idSchema).default([]),
  author: z.string().min(1, "Author is required"),
  publisher: z.string().min(1, "Publisher is required"),
  publishYear: z.number().int().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  price: z.number().int().min(0, "Price must be >= 0").default(0),
  buyPrice: z.number().int().min(0, "Buy price must be >= 0").optional(),
  sellPrice: z.number().int().min(0, "Sell price must be >= 0").optional(),
});

const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  publicTitle: z.string().nullable().optional(),
  supplierIds: z.array(idSchema).optional(),
  author: z.string().min(1).optional(),
  publisher: z.string().min(1).optional(),
  publishYear: z.number().int().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  price: z.number().int().min(0, "Price must be >= 0").optional(),
  buyPrice: z.number().int().min(0, "Buy price must be >= 0").optional(),
  sellPrice: z.number().int().min(0, "Sell price must be >= 0").optional(),
});

/** Sajikan harga beli/jual efektif (fallback ke harga lama) agar daftar/detail selalu terisi. */
function withEffectivePrices<T extends { price: number; buyPrice: number; sellPrice: number }>(book: T) {
  return { ...book, buyPrice: effectiveBuyPrice(book), sellPrice: effectiveSellPrice(book) };
}

booksRouter.get("/", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const allBooks: Array<typeof books.$inferSelect> = await db.select().from(books);
  const links: Array<{ bookId: string; supplierId: string }> =
    allBooks.length === 0
      ? []
      : await db
          .select({ bookId: bookSuppliers.bookId, supplierId: bookSuppliers.supplierId })
          .from(bookSuppliers)
          .where(
            inArray(
              bookSuppliers.bookId,
              allBooks.map((b: typeof books.$inferSelect) => b.id)
            )
          );
  const byBook = new Map<string, string[]>();
  for (const l of links) {
    const list = byBook.get(l.bookId) ?? [];
    list.push(l.supplierId);
    byBook.set(l.bookId, list);
  }
  return c.json({
    success: true,
    data: allBooks.map((b: typeof books.$inferSelect) => ({ ...withEffectivePrices(b), supplierIds: byBook.get(b.id) ?? [] })),
  });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

booksRouter.get("/:id", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const id = c.req.param("id");
    const [book] = await db.select().from(books).where(eq(books.id, id));
    if (!book) {
      return c.json({ success: false, message: "Book not found" }, 404);
    }
    return c.json({ success: true, data: withEffectivePrices(await withSuppliers(db, book)) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

booksRouter.post("/", zValidator("json", createBookSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const [existingIsbn] = await db.select().from(books).where(eq(books.isbn, body.isbn));  if (existingIsbn) {
    return c.json({ success: false, message: "Book with this ISBN already exists" }, 400);
  }

  const [newBook] = await db
    .insert(books)
    .values({
      id,
      isbn: body.isbn,
      title: body.title,
      publicTitle: body.publicTitle?.trim() || null,
      author: body.author,
      publisher: body.publisher,
      publishYear: body.publishYear,
      category: body.category,
      description: body.description,
      coverUrl: body.coverUrl,
      price: body.price ?? 0,
      buyPrice: body.buyPrice ?? body.price ?? 0,
      sellPrice: body.sellPrice ?? body.price ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  try {
    await replaceBookSuppliers(db, id, body.supplierIds ?? [], now);
  } catch (err) {
    return c.json({ success: false, message: err instanceof Error ? err.message : "Supplier tidak valid" }, 400);
  }

  return c.json({ success: true, data: withEffectivePrices(await withSuppliers(db, newBook)) }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Update book catalog fields (incl. harga beli/jual terpisah)
booksRouter.patch("/:id", zValidator("json", updateBookSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const id = c.req.param("id");
  const body = c.req.valid("json");

  const { supplierIds, publicTitle, ...rest } = body;
  const [updated] = await db
    .update(books)
    .set({ ...rest, ...(publicTitle !== undefined ? { publicTitle: publicTitle?.trim() || null } : {}), updatedAt: new Date().toISOString() })
    .where(eq(books.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, message: "Book not found" }, 404);
  }

  if (supplierIds !== undefined) {
    try {
      await replaceBookSuppliers(db, id, supplierIds, new Date().toISOString());
    } catch (err) {
      return c.json({ success: false, message: err instanceof Error ? err.message : "Supplier tidak valid" }, 400);
    }
  }

  // Perubahan harga jual / harga lama memicu hitung ulang semua paket pemakai buku ini.
  if (body.sellPrice !== undefined || body.price !== undefined) {
    const recalcCount = await recalcPackagesUsingBook(db, id);
    if (recalcCount > 0) {
      return c.json({
        success: true,
        data: withEffectivePrices(await withSuppliers(db, updated)),
        message: `Harga jual diperbarui; ${recalcCount} paket dihitung ulang.`,
      });
    }
  }
  return c.json({ success: true, data: withEffectivePrices(await withSuppliers(db, updated)) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Upload book cover endpoint
booksRouter.post("/:id/cover", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const bookId = c.req.param("id");
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) {
    return c.json({ success: false, message: "Book not found" }, 404);
  }

  const body = await c.req.parseBody();
  const file = body["cover"] as File | undefined;
  if (!file) {
    return c.json({ success: false, message: "No cover file uploaded" }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const extension = file.name.split(".").pop() || "jpg";
  const key = `covers/${bookId}-${Date.now()}.${extension}`;

  const coverUrl = await defaultStorage.upload(key, arrayBuffer, file.type || "image/jpeg");

  await db
    .update(books)
    .set({ coverUrl, updatedAt: new Date().toISOString() })
    .where(eq(books.id, bookId));

  return c.json({ success: true, data: { coverUrl } });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// DELETE book (hapus judul buku jika tidak dipakai di paket/transaksi aktif)
booksRouter.delete("/:id", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const id = c.req.param("id");
  const [book] = await db.select().from(books).where(eq(books.id, id));
  if (!book) {
    return c.json({ success: false, message: "Buku tidak ditemukan" }, 404);
  }

  // Cek apakah dipakai di BOM paket
  const { bookPackageItems, bookPackages, bookItems, purchaseOrderItems, purchaseOrders } = await import("../../db/schema");
  const inPackages = await db
    .select({
      packageId: bookPackageItems.packageId,
      packageName: bookPackages.name,
    })
    .from(bookPackageItems)
    .innerJoin(bookPackages, eq(bookPackageItems.packageId, bookPackages.id))
    .where(eq(bookPackageItems.bookId, id));

  if (inPackages.length > 0) {
    const packageNames = Array.from(new Set(inPackages.map((p: { packageName: string }) => p.packageName))).join(", ");
    return c.json(
      {
        success: false,
        message: `Buku tidak dapat dihapus karena masih menjadi komponen dalam paket: "${packageNames}". Silakan hapus atau ubah komponen paket tersebut terlebih dahulu.`,
      },
      400
    );
  }

  // Cek apakah tercatat dalam riwayat Purchase Order (PO)
  const inPOs = await db
    .select({
      poNumber: purchaseOrders.poNumber,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrderItems.bookId, id));

  if (inPOs.length > 0) {
    const poNumbers = Array.from(new Set(inPOs.map((p: { poNumber: string }) => p.poNumber))).join(", ");
    return c.json(
      {
        success: false,
        message: `Buku tidak dapat dihapus karena tercatat dalam dokumen Purchase Order: ${poNumbers}. Buku ini memiliki riwayat pengadaan resmi.`,
      },
      400
    );
  }

  // Hapus eksemplar satuan yang berstatus in_stock / disposed
  await db.delete(bookItems).where(eq(bookItems.bookId, id));
  await db.delete(books).where(eq(books.id, id));

  return c.json({ success: true, message: `Buku "${book.title}" berhasil dihapus` });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

