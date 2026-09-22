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

    // Verify round-trip media serving: fetch the actual image URL via the main app
    const { app } = await import("../index");
    const mediaRes = await app.request(uploadJson.data.coverUrl, { method: "GET" });
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers.get("Content-Type")).toBe("image/jpeg");
    const imageBytes = await mediaRes.text();
    expect(imageBytes).toBe("test-image-bytes");
  });
});
