import { describe, expect, it } from "bun:test";
import { bookItemsRouter } from "./bookItems";
import { db } from "../../db";
import { books, schools, bookItems } from "../../db/schema";
import { eq } from "drizzle-orm";

describe("Book Items (Physical Copies) API", () => {
  it("batch generates physical copies and allows barcode lookup", async () => {
    // Setup test school and book
    const schoolId = crypto.randomUUID();
    const bookId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Items Test School",
      code: "TEST-ITEM-SCH",
      type: "main",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(books).values({
      id: bookId,
      isbn: "978-0201616224",
      title: "The Pragmatic Programmer",
      author: "David Thomas",
      publisher: "Addison-Wesley",
      createdAt: now,
      updatedAt: now,
    });

    // Batch generate 5 copies
    const genRes = await bookItemsRouter.request("/batch-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId,
        schoolId,
        count: 5,
        barcodePrefix: "PRAG",
      }),
    });
    const genJson = await genRes.json();
    expect(genRes.status).toBe(201);
    expect(genJson.count).toBe(5);
    expect(genJson.data.length).toBe(5);

    const firstCopy = genJson.data[0];
    expect(firstCopy.barcode).toContain("PRAG-");
    expect(firstCopy.status).toBe("in_stock");

    // Lookup by barcode
    const lookupRes = await bookItemsRouter.request(`/barcode/${firstCopy.barcode}`, { method: "GET" });
    const lookupJson = await lookupRes.json();
    expect(lookupRes.status).toBe(200);
    expect(lookupJson.data.id).toBe(firstCopy.id);
    expect(lookupJson.data.book.title).toBe("The Pragmatic Programmer");

    // Update condition
    const patchRes = await bookItemsRouter.request(`/${firstCopy.id}/condition`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condition: "fair",
        notes: "Minor wear on spine",
      }),
    });
    const patchJson = await patchRes.json();
    expect(patchRes.status).toBe(200);
    expect(patchJson.data.condition).toBe("fair");
    expect(patchJson.data.notes).toBe("Minor wear on spine");

    // Cleanup
    await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, schoolId));
  });
});
