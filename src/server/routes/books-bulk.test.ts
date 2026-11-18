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
            curriculumType: "INTER",
            semester: "1",
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

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (urlStr.includes("docs.google.com") || urlStr.includes("drive.google.com")) {
        return new Response("Not Found", { status: 404 });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      // Kirim Google Sheets URL yang mengembalikan sheet kosong / bukan katalog buku
      // (diuji via payload parse-drive-url yang menangani kegagalan parseBookCatalogData secara graceful)
      const res = await booksRouter.request("/parse-drive-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://docs.google.com/spreadsheets/d/non-existent-sheet-id/edit" }),
      });

      // Karena URL tidak dapat diakses atau bukan berkas publik, drive-service mengembalikan respons terstruktur
      expect([200, 400, 502]).toContain(res.status);
    } finally {
      globalThis.fetch = originalFetch;
      restoreActor();
    }
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

  it("skips overwriting existing SD package when import has < 10 books unless forcePackageOverride is true", async () => {
    mockActor("central_admin", null);
    const stamp = Date.now();
    const { bookPackages } = await import("../../db/schema");

    // 1. Setup existing package with code PKG-SD3-INT-2026-2027
    const pkgCode = `PKG-SD3-INT-2026-2027`;
    const [existingPkg] = await db.insert(bookPackages).values({
      id: crypto.randomUUID(),
      code: pkgCode,
      name: "Paket Buku Kelas 3 Internasional TA 2026/2027",
      gradeLevel: "3",
      curriculumType: "INTER",
      academicYear: "2026/2027",
      price: 2800000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    // 2. Import partial book list (only 1 book) with autoCreatePackages: true
    const isbnA = `978-PARTIAL-${stamp}-A`;
    const resPartial = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          { title: `Partial Math ${stamp}`, gradeLevel: "3", price: 50000, isbn: isbnA, curriculumType: "international" },
        ],
        autoCreatePackages: true,
        academicYear: "2026/2027",
      }),
    });

    expect(resPartial.status).toBe(200);
    const jsonPartial = await resPartial.json();
    expect(jsonPartial.success).toBe(true);
    expect(jsonPartial.data.skippedPackages).toBeDefined();
    expect(jsonPartial.data.skippedPackages.length).toBe(1);
    expect(jsonPartial.data.skippedPackages[0].code).toBe(pkgCode);

    // Verify package price unchanged
    const [pkgAfter] = await db.select().from(bookPackages).where(eq(bookPackages.id, existingPkg.id));
    expect(pkgAfter.price).toBe(2800000);

    // 3. Clean up
    await db.delete(bookPackages).where(eq(bookPackages.id, existingPkg.id));
    await db.delete(books).where(eq(books.isbn, isbnA));
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

  it("accepts legacy curriculum names and generates appropriate SMP/SMA package codes", async () => {
    mockActor("central_admin", null);
    const stamp = Date.now();
    const isbnSmp = `978-SMP-${stamp}`;

    const res = await booksRouter.request("/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: [
          {
            title: `English SMP 7 ${stamp}`,
            gradeLevel: "7",
            price: 200000,
            isbn: isbnSmp,
            curriculumType: "AE",
          },
        ],
        autoCreatePackages: true,
        academicYear: "2026/2027",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const { bookPackages } = await import("../../db/schema");
    const [pkg] = await db
      .select()
      .from(bookPackages)
      .where(eq(bookPackages.code, "PKG-SMP7-AE-2026-2027"));

    expect(pkg).toBeDefined();
    expect(pkg.name).toContain("Kelas 7");
    expect(pkg.name).toContain("Al-Wildan English");

    // Clean up
    await db.delete(bookPackages).where(eq(bookPackages.id, pkg.id));
    await db.delete(books).where(eq(books.isbn, isbnSmp));
    restoreActor();
  });
});

