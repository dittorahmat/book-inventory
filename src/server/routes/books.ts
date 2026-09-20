import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { books } from "../../db/schema";
import { defaultStorage } from "../../services/storage";

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
});

booksRouter.get("/", async (c) => {
  const allBooks = await db.select().from(books);
  return c.json({ success: true, data: allBooks });
});

booksRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [book] = await db.select().from(books).where(eq(books.id, id));
  if (!book) {
    return c.json({ success: false, message: "Book not found" }, 404);
  }
  return c.json({ success: true, data: book });
});

booksRouter.post("/", zValidator("json", createBookSchema), async (c) => {
  const body = c.req.valid("json");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const [existingIsbn] = await db.select().from(books).where(eq(books.isbn, body.isbn));
  if (existingIsbn) {
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
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: newBook }, 201);
});

// Upload book cover endpoint
booksRouter.post("/:id/cover", async (c) => {
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
});
