import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { bookItems, bookPackages, books, bookStocks, packageItems, packageStocks, schools } from "../../../db/schema";
import { allocateInventoryStock } from "./allocation";

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

      const two = await allocateInventoryStock(
        { kind: "loose", targetId: bookId, schoolId, quantity: 2 },
        db
      );
      expect(two.ok).toBe(true);
      if (!two.ok) return;
      expect(two.items.map((r) => r.id)).toEqual([ids[1], ids[2]]);
      expect(two.items[0].kind).toBe("loose");

      const short = await allocateInventoryStock(
        { kind: "loose", targetId: bookId, schoolId, quantity: 5 },
        db
      );
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

  it("allocates packages via unified allocateInventoryStock", async () => {
    const stamp = Date.now();
    const schoolId = `sch-pkg-alloc-${stamp}`;
    const packageId = `pkg-alloc-${stamp}`;
    const now = new Date().toISOString();
    const pkgItemIds = [`pi-alloc-${stamp}-0`, `pi-alloc-${stamp}-1`];
    try {
      await db.insert(schools).values({
        id: schoolId, name: "Cabang Paket", code: `PKG-${stamp}`, type: "branch",
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookPackages).values({
        id: packageId, name: "Paket Alokasi", code: `PKGC-${stamp}`,
        gradeLevel: "1", curriculumType: "national", academicYear: "2026/2027",
        price: 150000, createdAt: now, updatedAt: now,
      });
      for (let i = 0; i < 2; i++) {
        await db.insert(packageItems).values({
          id: pkgItemIds[i], packageId, currentSchoolId: schoolId,
          barcode: `BC-PKG-${stamp}-${i}`, status: "in_stock",
          createdAt: now, updatedAt: now,
        });
      }

      const res = await allocateInventoryStock(
        { kind: "package", targetId: packageId, schoolId, quantity: 1 },
        db
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.items.length).toBe(1);
      expect(res.items[0].kind).toBe("package");
      expect(res.items[0].id).toBe(pkgItemIds[0]);

      const over = await allocateInventoryStock(
        { kind: "package", targetId: packageId, schoolId, quantity: 5 },
        db
      );
      expect(over.ok).toBe(false);
      if (over.ok) return;
      expect(over.message).toMatch(/Bundel paket tidak cukup/);
    } finally {
      for (const id of pkgItemIds) await db.delete(packageItems).where(eq(packageItems.id, id));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("prioritizes aggregate stock tables (book_stocks & package_stocks) when present", async () => {
    const stamp = Date.now();
    const schoolId = `sch-aggr-alc-${stamp}`;
    const bookId = `b-aggr-alc-${stamp}`;
    const packageId = `pkg-aggr-alc-${stamp}`;
    const now = new Date().toISOString();

    try {
      await db.insert(schools).values({
        id: schoolId, name: "Cabang Agregat", code: `CAG-${stamp}`, type: "branch",
        createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-CAG-${stamp}`, title: "Buku Agregat", author: "QA",
        publisher: "QA Press", createdAt: now, updatedAt: now,
      });
      await db.insert(bookPackages).values({
        id: packageId, name: "Paket Agregat", code: `PKGCAG-${stamp}`,
        gradeLevel: "1", curriculumType: "national", academicYear: "2026/2027",
        price: 200000, createdAt: now, updatedAt: now,
      });

      // Insert ke tabel agregat dengan saldo cukup
      await db.insert(bookStocks).values({
        id: `bstk-${stamp}`, bookId, schoolId, availableQuantity: 5, reservedQuantity: 0, updatedAt: now,
      });
      await db.insert(packageStocks).values({
        id: `pstk-${stamp}`, packageId, schoolId, availableQuantity: 3, reservedQuantity: 0, updatedAt: now,
      });

      // Alokasi buku satuan harus sukses membaca book_stocks tanpa ada row di book_items
      const looseRes = await allocateInventoryStock(
        { kind: "loose", targetId: bookId, schoolId, quantity: 4 },
        db
      );
      expect(looseRes.ok).toBe(true);
      if (looseRes.ok) {
        expect(looseRes.items).toHaveLength(4);
        expect(looseRes.items[0].kind).toBe("loose");
      }

      // Alokasi melebihi stok agregat
      const looseShort = await allocateInventoryStock(
        { kind: "loose", targetId: bookId, schoolId, quantity: 10 },
        db
      );
      expect(looseShort.ok).toBe(false);
      if (!looseShort.ok) {
        expect(looseShort.available).toBe(5);
        expect(looseShort.needed).toBe(10);
      }

      // Alokasi paket harus sukses membaca package_stocks tanpa ada row di package_items
      const pkgRes = await allocateInventoryStock(
        { kind: "package", targetId: packageId, schoolId, quantity: 2 },
        db
      );
      expect(pkgRes.ok).toBe(true);
      if (pkgRes.ok) {
        expect(pkgRes.items).toHaveLength(2);
        expect(pkgRes.items[0].kind).toBe("package");
      }

      const pkgShort = await allocateInventoryStock(
        { kind: "package", targetId: packageId, schoolId, quantity: 5 },
        db
      );
      expect(pkgShort.ok).toBe(false);
      if (!pkgShort.ok) {
        expect(pkgShort.available).toBe(3);
        expect(pkgShort.needed).toBe(5);
      }
    } finally {
      await db.delete(bookStocks).where(eq(bookStocks.schoolId, schoolId));
      await db.delete(packageStocks).where(eq(packageStocks.schoolId, schoolId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
