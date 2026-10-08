import { describe, expect, it } from "bun:test";
import { booksRouter } from "./books";
import { db } from "../../db";
import { books } from "../../db/schema";
import { eq } from "drizzle-orm";

describe("Books Catalog API", () => {
  it("creates a book in catalog and supports cover image upload", async () => {
    // Cleanup existing test book
    await db.delete(books).where(eq(books.isbn, "978-0132350884"));

    const createRes = await booksRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isbn: "978-0132350884",
        title: "Clean Code",
        author: "Robert C. Martin",
        publisher: "Prentice Hall",
        publishYear: 2008,
        category: "Software Engineering",
      }),
    });
    const createJson = await createRes.json();
    expect(createRes.status).toBe(201);
    expect(createJson.data.title).toBe("Clean Code");
    const bookId = createJson.data.id;

    // Upload cover image
    const formData = new FormData();
    const fakeImage = new Blob(["test-image-bytes"], { type: "image/jpeg" });
    formData.append("cover", fakeImage, "clean-code.jpg");

    const uploadRes = await booksRouter.request(`/${bookId}/cover`, {
      method: "POST",
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    expect(uploadRes.status).toBe(200);
    expect(uploadJson.data.coverUrl).toContain("covers/");

    // Verify persisted coverUrl in book record
    const getRes = await booksRouter.request(`/${bookId}`, { method: "GET" });
    const getJson = await getRes.json();
    expect(getJson.data.coverUrl).toBe(uploadJson.data.coverUrl);

    // Books without explicit price default to 0
    expect(getJson.data.price).toBe(0);

    // Verify round-trip media serving: fetch the actual image URL via the main app
    const { app } = await import("../index");
    const mediaRes = await app.request(uploadJson.data.coverUrl, { method: "GET" });
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers.get("Content-Type")).toBe("image/jpeg");
    const imageBytes = await mediaRes.text();
    expect(imageBytes).toBe("test-image-bytes");
  });

  it("creates a book with manual unit price and rejects negative prices", async () => {
    await db.delete(books).where(eq(books.isbn, "978-0000000001"));

    const createRes = await booksRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isbn: "978-0000000001",
        title: "Priced Book",
        author: "Test Author",
        publisher: "Test Publisher",
        price: 95000,
      }),
    });
    const createJson = await createRes.json();
    expect(createRes.status).toBe(201);
    expect(createJson.data.price).toBe(95000);

    const patchRes = await booksRouter.request(`/${createJson.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 120000 }),
    });
    const patchJson = await patchRes.json();
    expect(patchRes.status).toBe(200);
    expect(patchJson.data.price).toBe(120000);

    const badRes = await booksRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isbn: "978-0000000002",
        title: "Bad Price Book",
        author: "Test Author",
        publisher: "Test Publisher",
        price: -1000,
      }),
    });
    expect(badRes.status).toBe(400);

    await db.delete(books).where(eq(books.isbn, "978-0000000001"));
  });

  it("rejects deleting a book bound to a package and returns package names in error", async () => {
    const { bookPackages, bookPackageItems } = await import("../../db/schema");
    const testBookId = `test-del-book-${Date.now()}`;
    const testPkgId = `test-del-pkg-${Date.now()}`;

    // Seed book
    await db.insert(books).values({
      id: testBookId,
      isbn: `978-TEST-${Date.now()}`,
      title: "Matematika Dasar Kurikulum",
      author: "Penulis Uji",
      publisher: "Penerbit Uji",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed package
    await db.insert(bookPackages).values({
      id: testPkgId,
      code: `PKG-TEST-${Date.now()}`,
      name: "Paket Tematik Kelas 1 SD",
      gradeLevel: "1",
      academicYear: "2026/2027",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Link book to package
    await db.insert(bookPackageItems).values({
      id: `bpi-${Date.now()}`,
      packageId: testPkgId,
      bookId: testBookId,
      quantity: 1,
      createdAt: new Date().toISOString(),
    });

    // Attempt delete -> should fail with 400 and list the package name
    const delRes = await booksRouter.request(`/${testBookId}`, { method: "DELETE" });
    const delJson = await delRes.json();
    expect(delRes.status).toBe(400);
    expect(delJson.success).toBe(false);
    expect(delJson.message).toContain("Paket Tematik Kelas 1 SD");

    // Unlink / cleanup package link
    await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, testPkgId));
    await db.delete(bookPackages).where(eq(bookPackages.id, testPkgId));

    // Attempt delete again -> should succeed now
    const delSuccessRes = await booksRouter.request(`/${testBookId}`, { method: "DELETE" });
    const delSuccessJson = await delSuccessRes.json();
    expect(delSuccessRes.status).toBe(200);
    expect(delSuccessJson.success).toBe(true);

    // Verify removed
    const checkRes = await booksRouter.request(`/${testBookId}`, { method: "GET" });
    expect(checkRes.status).toBe(404);
  });
});
