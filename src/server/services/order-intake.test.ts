import { describe, expect, it } from "bun:test";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { bookItems, books, schools } from "../../db/schema";
import { reserveLooseLines, resolveLooseLines } from "./order-intake";

const now = new Date().toISOString();
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

async function seedStock(tag: string, copies: number) {
  const schoolId = `sch-intake-${tag}-${stamp()}`;
  const bookId = `book-intake-${tag}-${stamp()}`;
  await db.insert(schools).values({
    id: schoolId, name: `Intake ${tag}`, code: `INT-${tag}-${Date.now()}`, type: "branch",
    createdAt: now, updatedAt: now,
  });
  await db.insert(books).values({
    id: bookId, isbn: `ISBN-INT-${tag}-${Date.now()}`, title: `Buku Intake ${tag}`,
    author: "Test", publisher: "Test", sellPrice: 25000, createdAt: now, updatedAt: now,
  });
  await db.insert(bookItems).values(
    Array.from({ length: copies }, (_, j) => ({
      id: `bi-intake-${tag}-${stamp()}-${j}`,
      bookId, currentSchoolId: schoolId, barcode: `INT-${tag}-${Date.now()}-${j}`,
      condition: "new" as const, status: "in_stock" as const, createdAt: now, updatedAt: now,
    }))
  );
  return { schoolId, bookId };
}

async function cleanupStock(schoolId: string, bookId: string) {
  await db.delete(bookItems).where(eq(bookItems.currentSchoolId, schoolId));
  await db.delete(books).where(eq(books.id, bookId));
  await db.delete(schools).where(eq(schools.id, schoolId));
}

describe("order-intake shared seam", () => {
  it("resolves lines with effective sell price and 404s unknown titles", async () => {
    const { schoolId, bookId } = await seedStock("resolve", 1);
    try {
      const resolved = await resolveLooseLines(db, [{ bookId, quantity: 1 }]);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      expect(resolved.lines).toEqual([{ bookId, title: `Buku Intake resolve`, quantity: 1, unitPrice: 25000 }]);

      const missing = await resolveLooseLines(db, [{ bookId: `nope-${stamp()}`, quantity: 1 }]);
      expect(missing.ok).toBe(false);
      if (missing.ok) return;
      expect(missing.status).toBe(404);
    } finally {
      await cleanupStock(schoolId, bookId);
    }
  });

  it("aggregates duplicate titles so over-reservation fails once with counts", async () => {
    const { schoolId, bookId } = await seedStock("agg", 3);
    try {
      // Duplikat qty 2+2 = 4 lawan stok 3: agregasi menolak (dulu dua cek 2-satuan lolos dua-duanya).
      const failed = await reserveLooseLines(db, schoolId, [
        { bookId, title: "x", quantity: 2, unitPrice: 25000 },
        { bookId, title: "x", quantity: 2, unitPrice: 25000 },
      ]);
      expect(failed.ok).toBe(false);
      if (failed.ok) return;
      expect(failed.bookId).toBe(bookId);
      expect(failed.quantity).toBe(4);
      expect(failed.available).toBe(3);

      const ok = await reserveLooseLines(db, schoolId, [
        { bookId, title: "x", quantity: 3, unitPrice: 25000 },
      ]);
      expect(ok.ok).toBe(true);
      if (!ok.ok) return;
      expect(ok.allocatedIds.length).toBe(3);
    } finally {
      await cleanupStock(schoolId, bookId);
    }
  });
});
