import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import { bookItems, books, schools } from "../../db/schema";
import {
  accessErrorResponse,
  assertLocationAllowed,
  loadLocationIds,
  resolveLocationScope,
  resolveRequestActor,
} from "../services/access-scope";

export const bookItemsRouter = new Hono();

const batchGenerateCopiesSchema = z.object({
  bookId: z.string().min(1, "Book ID is required"),
  schoolId: z.string().min(1, "School ID is required"),
  count: z.number().int().min(1).max(200),
  barcodePrefix: z.string().min(2).max(10).default("BK"),
  condition: z.enum(["new", "good", "fair", "damaged"]).default("new"),
});

const updateConditionSchema = z.object({
  condition: z.enum(["new", "good", "fair", "damaged"]),
  notes: z.string().optional(),
});

// List copies with optional school isolation filter
bookItemsRouter.get("/", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const schoolId = c.req.query("schoolId");
    const bookId = c.req.query("bookId");
    const status = c.req.query("status");
    const scope = new Set(resolveLocationScope(actor, schoolId, locations));

  let query = db.select({
    id: bookItems.id,
    barcode: bookItems.barcode,
    condition: bookItems.condition,
    status: bookItems.status,
    notes: bookItems.notes,
    createdAt: bookItems.createdAt,
    book: {
      id: books.id,
      title: books.title,
      isbn: books.isbn,
      author: books.author,
      coverUrl: books.coverUrl,
      price: books.price,
    },
    school: {
      id: schools.id,
      name: schools.name,
      code: schools.code,
    },
  })
  .from(bookItems)
  .leftJoin(books, eq(bookItems.bookId, books.id))
  .leftJoin(schools, eq(bookItems.currentSchoolId, schools.id));

  const conditions = [];
  if (scope.size < locations.length) {
    conditions.push(inArray(bookItems.currentSchoolId, [...scope]));
  } else if (schoolId) {
    conditions.push(eq(bookItems.currentSchoolId, schoolId));
  }
  if (bookId) conditions.push(eq(bookItems.bookId, bookId));
  if (status) conditions.push(eq(bookItems.status, status as "in_stock" | "in_transit" | "disposed" | "lost"));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const items = await query;
  return c.json({ success: true, data: items });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Lookup copy by barcode (useful for scanner)
bookItemsRouter.get("/barcode/:barcode", async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const barcode = c.req.param("barcode");
  const [item] = await db
    .select({
      id: bookItems.id,
      barcode: bookItems.barcode,
      condition: bookItems.condition,
      status: bookItems.status,
      notes: bookItems.notes,
      currentSchoolId: bookItems.currentSchoolId,
      book: {
        id: books.id,
        title: books.title,
        isbn: books.isbn,
        price: books.price,
      },
    })
    .from(bookItems)
    .leftJoin(books, eq(bookItems.bookId, books.id))
    .where(eq(bookItems.barcode, barcode));

  if (!item) {
    return c.json({ success: false, message: "Barcode not found" }, 404);
  }
  assertLocationAllowed(actor, item.currentSchoolId, locations);
  return c.json({ success: true, data: item });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Batch create physical copies
bookItemsRouter.post("/batch-generate", zValidator("json", batchGenerateCopiesSchema), async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const body = c.req.valid("json");
    assertLocationAllowed(actor, body.schoolId, locations);
    const now = new Date().toISOString();
    const timestampPart = Date.now().toString().slice(-4);

  const inserted = [];
  for (let i = 1; i <= body.count; i++) {
    const id = crypto.randomUUID();
    const barcode = `${body.barcodePrefix}-${timestampPart}-${Math.floor(1000 + Math.random() * 9000)}-${i}`;

    const [row] = await db
      .insert(bookItems)
      .values({
        id,
        bookId: body.bookId,
        currentSchoolId: body.schoolId,
        barcode,
        condition: body.condition,
        status: "in_stock",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    inserted.push(row);
  }

  return c.json({ success: true, count: inserted.length, data: inserted }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// Update condition of a copy
bookItemsRouter.patch("/:id/condition", zValidator("json", updateConditionSchema), async (c) => {
  try {
    const actor = await resolveRequestActor(c);
    const locations = await loadLocationIds(db);
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const [existing] = await db.select().from(bookItems).where(eq(bookItems.id, id));
    if (!existing) {
      return c.json({ success: false, message: "Copy not found" }, 404);
    }
    assertLocationAllowed(actor, existing.currentSchoolId, locations);

  const [updated] = await db
    .update(bookItems)
    .set({
      condition: body.condition,
      notes: body.notes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(bookItems.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, message: "Copy not found" }, 404);
  }
  return c.json({ success: true, data: updated });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
