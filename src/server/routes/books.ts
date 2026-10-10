import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { books } from "../../db/schema";
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

export const booksRouter = new Hono();

const createBookSchema = z.object({
  isbn: z.string().min(10, "Valid ISBN required"),
  title: z.string().min(1, "Title is required"),
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
  const allBooks = await db.select().from(books);
  return c.json({ success: true, data: allBooks.map(withEffectivePrices) });
});

booksRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [book] = await db.select().from(books).where(eq(books.id, id));
  if (!book) {
    return c.json({ success: false, message: "Book not found" }, 404);
  }
  return c.json({ success: true, data: withEffectivePrices(book) });
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

  return c.json({ success: true, data: withEffectivePrices(newBook) }, 201);
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

  const [updated] = await db
    .update(books)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(books.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, message: "Book not found" }, 404);
  }

  // Perubahan harga jual / harga lama memicu hitung ulang semua paket pemakai buku ini.
  if (body.sellPrice !== undefined || body.price !== undefined) {
    const recalcCount = await recalcPackagesUsingBook(db, id);
    if (recalcCount > 0) {
      return c.json({
        success: true,
        data: withEffectivePrices(updated),
        message: `Harga jual diperbarui; ${recalcCount} paket dihitung ulang.`,
      });
    }
  }
  return c.json({ success: true, data: withEffectivePrices(updated) });
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

