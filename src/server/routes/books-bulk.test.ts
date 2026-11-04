import { describe, expect, it, beforeEach } from "bun:test";
import { booksRouter } from "./books";
import { mockActor, restoreActor } from "./test-actor";
import { db } from "../../db";
import { books } from "../../db/schema";
import { eq } from "drizzle-orm";

describe("POST /api/books/bulk-import", () => {
  beforeEach(() => {
    mockActor("central_admin", null);
  });

  it("successfully imports multiple books and updates existing on duplicate ISBN", async () => {
    const stamp = Date.now();
    const isbn1 = `978-BLK-${stamp}-1`;
    const isbn2 = `978-BLK-${stamp}-2`;

    const res = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          {
            title: `Buku Bulk A ${stamp}`,
            gradeLevel: "1",
            price: 50000,
            buyPrice: 35000,
            isbn: isbn1,
            subject: "Matematika",
            publisher: "Penerbit Al-Wildan",
          },
          {
            title: `Buku Bulk B ${stamp}`,
            gradeLevel: "2",
            price: 65000,
            isbn: isbn2,
            subject: "Bahasa Inggris",
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.insertedCount).toBe(2);
    expect(json.data.updatedCount).toBe(0);

    // Re-import with updated price for isbn1
    const reRes = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          {
            title: `Buku Bulk A Updated ${stamp}`,
            gradeLevel: "1",
            price: 55000,
            isbn: isbn1,
          },
        ],
      }),
    });

    expect(reRes.status).toBe(200);
    const reJson = await reRes.json();
    expect(reJson.data.insertedCount).toBe(0);
    expect(reJson.data.updatedCount).toBe(1);

    // Verify database value
    const [saved] = await db.select().from(books).where(eq(books.isbn, isbn1));
    expect(saved.price).toBe(55000);
    expect(saved.title).toBe(`Buku Bulk A Updated ${stamp}`);

    // Clean up
    await db.delete(books).where(eq(books.isbn, isbn1));
    await db.delete(books).where(eq(books.isbn, isbn2));
    restoreActor();
  });

  it("rejects unauthorized non-admin staff roles", async () => {
    mockActor("branch_admin", "school-alw-1");

    const res = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          {
            title: "Buku Unauthorized",
            gradeLevel: "1",
            price: 10000,
          },
        ],
      }),
    });

    expect(res.status).toBe(403);
    restoreActor();
  });
});
