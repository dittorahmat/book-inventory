import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { booksRouter } from "./books";
import { db } from "../../db";
import { books } from "../../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";

const realGetSession = auth.api.getSession;
function actAs(role: "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin" | null, schoolId: string | null) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-test", role, schoolId } } as any) : null;
}
beforeEach(() => actAs("central_admin", null));
afterEach(() => {
  (auth.api as any).getSession = realGetSession;
});

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

describe("Books master RBAC (#43)", () => {
  const stamp = Date.now().toString().slice(-6);
  const seedId = `b-rbac43-${stamp}`;

  async function seedBook() {
    await db.insert(books).values({
      id: seedId,
      isbn: `978-RBAC43-${stamp}`,
      title: "Buku Kunci Master",
      author: "QA",
      publisher: "QA Press",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).onConflictDoNothing();
  }

  function bookPayload(isbn: string) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbn, title: "X", author: "X", publisher: "X" }),
    } as const;
  }

  it("menolak mutasi katalog tanpa sesi (401) dan oleh peran sekolah (403)", async () => {
    await seedBook();
    try {
      actAs(null, null);
      expect((await booksRouter.request("/", bookPayload(`978-A43-${stamp}`))).status).toBe(401);
      expect((await booksRouter.request(`/${seedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Coba Ubah" }),
      })).status).toBe(401);
      const anonCover = new FormData();
      anonCover.append("cover", new Blob(["x"], { type: "image/jpeg" }), "c.jpg");
      expect((await booksRouter.request(`/${seedId}/cover`, { method: "POST", body: anonCover })).status).toBe(401);
      expect((await booksRouter.request(`/${seedId}`, { method: "DELETE" })).status).toBe(401);

      actAs("school_admin", "school-alw-1");
      expect((await booksRouter.request("/", bookPayload(`978-S43-${stamp}`))).status).toBe(403);
      expect((await booksRouter.request(`/${seedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Coba Ubah" }),
      })).status).toBe(403);
      const schoolCover = new FormData();
      schoolCover.append("cover", new Blob(["x"], { type: "image/jpeg" }), "c.jpg");
      expect((await booksRouter.request(`/${seedId}/cover`, { method: "POST", body: schoolCover })).status).toBe(403);
      expect((await booksRouter.request(`/${seedId}`, { method: "DELETE" })).status).toBe(403);
    } finally {
      await db.delete(books).where(eq(books.id, seedId));
    }
  });

  it("membiarkan daftar dan detail katalog terbaca publik", async () => {
    await seedBook();
    try {
      actAs(null, null);
      expect((await booksRouter.request("/", { method: "GET" })).status).toBe(200);
      expect((await booksRouter.request(`/${seedId}`, { method: "GET" })).status).toBe(200);
    } finally {
      await db.delete(books).where(eq(books.id, seedId));
    }
  });

  it("mengizinkan mutasi katalog oleh gudang dan pusat", async () => {
    await db.delete(books).where(eq(books.isbn, `978-W43-${stamp}`));
    actAs("warehouse_admin", "school-warehouse");
    const created = await booksRouter.request("/", bookPayload(`978-W43-${stamp}`));
    expect(created.status).toBe(201);
    const createdId = ((await created.json()) as any).data.id;
    try {
      actAs("central_admin", null);
      const patched = await booksRouter.request(`/${createdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Judul Gudang" }),
      });
      expect(patched.status).toBe(200);
    } finally {
      await db.delete(books).where(eq(books.id, createdId));
    }
  });
});
