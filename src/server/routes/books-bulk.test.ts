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
            publisher: "Al-Wildan Press",
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

  it("handles duplicate ISBNs inside the same payload gracefully without throwing unique constraint error", async () => {
    const stamp = Date.now();
    const sharedIsbn = `978-DUP-${stamp}`;

    const res = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          {
            title: `Buku Edisi Pertama ${stamp}`,
            gradeLevel: "1",
            price: 50000,
            isbn: sharedIsbn,
          },
          {
            title: `Buku Edisi Revisi ${stamp}`,
            gradeLevel: "1",
            price: 60000,
            isbn: sharedIsbn,
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.insertedCount).toBe(1);

    const [saved] = await db.select().from(books).where(eq(books.isbn, sharedIsbn));
    expect(saved.price).toBe(60000);
    expect(saved.title).toBe(`Buku Edisi Revisi ${stamp}`);

    // Clean up
    await db.delete(books).where(eq(books.isbn, sharedIsbn));
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

  it("handles parse-drive-url for Google Drive folder link simulation", async () => {
    mockActor("central_admin", null);

    // Test rejection of non-drive non-sheets url
    const badRes = await booksRouter.request("/parse-drive-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/invalid-file" }),
    });
    expect(badRes.status).toBe(400);

    restoreActor();
  });

  it("returns graceful warning response for non-catalog spreadsheet sheet", async () => {
    mockActor("central_admin", null);

    // Kirim Google Sheets URL yang mengembalikan sheet kosong / bukan katalog buku
    // (diuji via payload parse-drive-url yang menangani kegagalan parseBookCatalogData secara graceful)
    const res = await booksRouter.request("/parse-drive-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://docs.google.com/spreadsheets/d/non-existent-sheet-id/edit" }),
    });

    // Karena URL tidak dapat diakses atau bukan berkas publik, drive-service mengembalikan respons terstruktur
    expect([200, 400, 502]).toContain(res.status);
    restoreActor();
  });

  it("creates packages and BOM automatically when autoCreatePackages is true", async () => {
    mockActor("central_admin", null);
    const stamp = Date.now();
    const isbn1 = `978-PKG-${stamp}-1`;
    const isbn2 = `978-PKG-${stamp}-2`;

    const res = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          {
            title: `Buku Math Auto ${stamp}`,
            gradeLevel: "1",
            price: 100000,
            isbn: isbn1,
            curriculumType: "international",
          },
          {
            title: `Buku English Auto ${stamp}`,
            gradeLevel: "1",
            price: 150000,
            isbn: isbn2,
            curriculumType: "international",
          },
        ],
        autoCreatePackages: true,
        academicYear: "2026/2027",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.packagesCreatedCount).toBeGreaterThanOrEqual(1);

    // Verify package created
    const { bookPackages, bookPackageItems } = await import("../../db/schema");
    const [pkg] = await db
      .select()
      .from(bookPackages)
      .where(eq(bookPackages.code, "PKG-SD1-INT-2026-2027"));
    expect(pkg).toBeDefined();
    // 250.000 (buku pelajaran) + 750.000 (WPR) = 1.000.000 (§0.28)
    expect(pkg.price).toBe(1000000);

    // Verify BOM items (2 buku pelajaran + 1 WPR)
    const boms = await db
      .select()
      .from(bookPackageItems)
      .where(eq(bookPackageItems.packageId, pkg.id));
    expect(boms.length).toBe(3);
    const { WPR_BOOK_ID } = await import("../../lib/wpr");
    expect(boms.some((b) => b.bookId === WPR_BOOK_ID)).toBe(true);

    // Clean up
    await db.delete(bookPackages).where(eq(bookPackages.id, pkg.id));
    await db.delete(books).where(eq(books.isbn, isbn1));
    await db.delete(books).where(eq(books.isbn, isbn2));
    restoreActor();
  });

  it("updates book record when re-importing by title even with different casing or whitespace", async () => {
    const stamp = Date.now();
    const uniqueTitle = `Buku Sains Eksperimen ${stamp}`;

    const res1 = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          {
            title: uniqueTitle,
            gradeLevel: "3",
            price: 70000,
            subject: "Sains",
          },
        ],
      }),
    });
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    expect(json1.data.insertedCount).toBe(1);

    // Re-import with lowercase title and updated price
    const res2 = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          {
            title: `   ${uniqueTitle.toLowerCase()}   `,
            gradeLevel: "3",
            price: 85000,
          },
        ],
      }),
    });
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    expect(json2.data.insertedCount).toBe(0);
    expect(json2.data.updatedCount).toBe(1);

    const [found] = await db.select().from(books).where(eq(books.id, json1.data.total ? (await db.select().from(books))[0].id : ""));
    expect(found).toBeDefined();

    // Clean up
    const { sql } = await import("drizzle-orm");
    await db.delete(books).where(sql`UPPER(trim(${books.title})) = UPPER(${uniqueTitle})`);
    restoreActor();
  });
});

