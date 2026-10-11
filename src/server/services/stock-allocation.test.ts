import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { bookItems, books, schools } from "../../db/schema";
import { allocateLooseStock } from "./stock-allocation";

describe("stock allocation FIFO via SQL", () => {
  it("returns the oldest available items first and reports exact shortage", async () => {
    const stamp = Date.now();
    const schoolId = `sch-alloc-${stamp}`;
    const bookId = `b-alloc-${stamp}`;
    const now = new Date().toISOString();
    const ids = [`bi-alloc-${stamp}-0`, `bi-alloc-${stamp}-1`, `bi-alloc-${stamp}-2`];
    try {
      await db.insert(schools).values({
        id: schoolId, name: "Cabang Alokasi", code: `ALC-${stamp}`, type: "branch",
        createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-ALC-${stamp}`, title: "Buku Alokasi", author: "QA",
        publisher: "QA Press", createdAt: now, updatedAt: now,
      });
      // Dimasukkan tidak urut: FIFO harus tetap memilih createdAt terlama.
      const created = ["2026-10-03T10:00:00.000Z", "2026-10-01T10:00:00.000Z", "2026-10-02T10:00:00.000Z"];
      for (let i = 0; i < 3; i++) {
        await db.insert(bookItems).values({
          id: ids[i], bookId, currentSchoolId: schoolId, barcode: `BC-ALC-${stamp}-${i}`,
          condition: "new", status: "in_stock", createdAt: created[i], updatedAt: created[i],
        });
      }

      const two = await allocateLooseStock({ bookId, schoolId, quantity: 2 }, db);
      expect(two.ok).toBe(true);
      if (!two.ok) return;
      expect(two.items.map((r) => r.id)).toEqual([ids[1], ids[2]]);

      const short = await allocateLooseStock({ bookId, schoolId, quantity: 5 }, db);
      expect(short.ok).toBe(false);
      if (short.ok) return;
      expect(short.available).toBe(3);
      expect(short.needed).toBe(5);
      expect(short.message).toMatch(/Dibutuhkan 5 eksemplar, tersedia 3/);
    } finally {
      for (const id of ids) await db.delete(bookItems).where(eq(bookItems.id, id));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
