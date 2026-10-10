import { describe, expect, it } from "bun:test";
import { CatalogIntentError, createBookWithCover, type CatalogFetchAdapter } from "./catalog-intent";

const payload = { isbn: "978-0", title: "T", author: "A", publisher: "P", publishYear: 2024, category: "General", price: 1, buyPrice: 1, sellPrice: 2 };

const adapterOf = (over: Partial<CatalogFetchAdapter>): CatalogFetchAdapter => ({
  createBook: async () => ({ id: "b-1" }),
  uploadCover: async () => {},
  deleteBook: async () => {},
  ...over,
});

describe("spec-57 T6 catalog create-with-cover intent", () => {
  it("creates and uploads cover in one intent", async () => {
    const calls: string[] = [];
    const out = await createBookWithCover(
      adapterOf({
        createBook: async () => { calls.push("create"); return { id: "b-1" }; },
        uploadCover: async () => { calls.push("upload"); },
      }),
      payload,
      new File(["x"], "cover.png", { type: "image/png" })
    );
    expect(out).toEqual({ id: "b-1", coverUploaded: true });
    expect(calls).toEqual(["create", "upload"]);
  });

  it("skips upload when no cover file is given", async () => {
    let uploads = 0;
    const out = await createBookWithCover(
      adapterOf({ uploadCover: async () => { uploads++; } }),
      payload,
      null
    );
    expect(out).toEqual({ id: "b-1", coverUploaded: false });
    expect(uploads).toBe(0);
  });

  it("deletes the orphan book when cover upload fails and reports rollback", async () => {
    const calls: string[] = [];
    const failing = createBookWithCover(
      adapterOf({
        createBook: async () => { calls.push("create"); return { id: "b-orphan" }; },
        uploadCover: async () => { calls.push("upload"); throw new Error("R2 down"); },
        deleteBook: async () => { calls.push("delete"); },
      }),
      payload,
      new File(["x"], "cover.png", { type: "image/png" })
    );
    const err = await failing.then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(CatalogIntentError);
    expect((err as CatalogIntentError).code).toBe("cover-failed-rolled-back");
    expect(calls).toEqual(["create", "upload", "delete"]);
  });

  it("surfaces both failures when compensation delete also fails", async () => {
    const failing = createBookWithCover(
      adapterOf({
        createBook: async () => ({ id: "b-orphan" }),
        uploadCover: async () => { throw new Error("R2 down"); },
        deleteBook: async () => { throw new Error("DB down"); },
      }),
      payload,
      new File(["x"], "cover.png", { type: "image/png" })
    );
    const err = await failing.then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(CatalogIntentError);
    expect((err as CatalogIntentError).code).toBe("cover-failed-compensation-failed");
    expect((err as Error).message).toContain("R2 down");
  });
});
