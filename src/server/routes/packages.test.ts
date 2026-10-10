import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { packagesRouter } from "./packages";
import { db } from "../../db";
import { eq, inArray } from "drizzle-orm";
import { schools, books, bookItems, bookPackages, bookPackageItems, packageItems } from "../../db/schema";
import { runIdempotentSeed } from "../seed";

describe("Packages & Bundling/Unbundling API", () => {
  it("creates a package, checks stock potential, bundles and unbundles items", async () => {
    const schoolId = `test-pkg-school-${Date.now()}`;
    const bookId1 = `test-pkg-book-1-${Date.now()}`;
    const bookId2 = `test-pkg-book-2-${Date.now()}`;
    const pkgCode = `PKG-TEST-${Date.now()}`;
    const now = new Date().toISOString();

    // 1. Setup school & books (tipe warehouse karena perakitan eksklusif di Gudang)
    await db.insert(schools).values({
      id: schoolId,
      name: "Test Package Warehouse",
      code: `TPS-${Date.now()}`,
      type: "warehouse",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await db.insert(books).values([
      {
        id: bookId1,
        isbn: `ISBN-TEST-1-${Date.now()}`,
        title: "Cambridge Math P1",
        author: "Cambridge",
        publisher: "CUP",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: bookId2,
        isbn: `ISBN-TEST-2-${Date.now()}`,
        title: "Pendidikan Agama Islam 1",
        author: "Kemenag",
        publisher: "Erlangga",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 2. Create package with BOM (1 math + 1 agama)
    const createRes = await packagesRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: pkgCode,
        name: "Paket Test Kelas 1",
        gradeLevel: "1",
        curriculumType: "international",
        academicYear: "2026/2027",
        price: 750000,
        items: [
          { bookId: bookId1, quantity: 1 },
          { bookId: bookId2, quantity: 1 },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    const pkgId = createJson.data.id;

    // 3. Add loose items in school: 5 of book1 and 3 of book2
    for (let i = 0; i < 5; i++) {
      await db.insert(bookItems).values({
        id: `bi-1-${i}-${Date.now()}`,
        bookId: bookId1,
        currentSchoolId: schoolId,
        barcode: `BC-B1-${i}-${Date.now()}`,
        condition: "new",
        status: "in_stock",
        createdAt: now,
        updatedAt: now,
      });
    }
    for (let i = 0; i < 3; i++) {
      await db.insert(bookItems).values({
        id: `bi-2-${i}-${Date.now()}`,
        bookId: bookId2,
        currentSchoolId: schoolId,
        barcode: `BC-B2-${i}-${Date.now()}`,
        condition: "new",
        status: "in_stock",
        createdAt: now,
        updatedAt: now,
      });
    }

    // 4. Check stock potential (should be limited by 3 of book2)
    const stockRes = await packagesRouter.request(`/${pkgId}/stock/${schoolId}`, { method: "GET" });
    const stockJson = await stockRes.json();
    expect(stockRes.status).toBe(200);
    expect(stockJson.data.maxPossibleBundles).toBe(3);
    expect(stockJson.data.readyBundleCount).toBe(0);

    // 5. Bundle 2 packages
    const bundleRes = await packagesRouter.request(`/${pkgId}/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        quantity: 2,
      }),
    });
    expect(bundleRes.status).toBe(200);
    const bundleJson = await bundleRes.json();
    expect(bundleJson.data.quantityAssembled).toBe(2);

    // Verify ready count is now 2, max potential is now 1 (since 3 - 2 = 1)
    const stockAfterBundle = await packagesRouter.request(`/${pkgId}/stock/${schoolId}`, { method: "GET" });
    const stockAfterJson = await stockAfterBundle.json();
    expect(stockAfterJson.data.readyBundleCount).toBe(2);
    expect(stockAfterJson.data.maxPossibleBundles).toBe(1);

    // 6. Unbundle 1 package back to loose
    const unbundleRes = await packagesRouter.request(`/${pkgId}/unbundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        quantity: 1,
        reason: "Defect book return stock allocation",
      }),
    });
    expect(unbundleRes.status).toBe(200);

    // Ready bundles should now be 1, max potential should be back to 2
    const stockFinal = await packagesRouter.request(`/${pkgId}/stock/${schoolId}`, { method: "GET" });
    const stockFinalJson = await stockFinal.json();
    expect(stockFinalJson.data.readyBundleCount).toBe(1);
    expect(stockFinalJson.data.maxPossibleBundles).toBe(2);

    // 7. Batch endpoint setuju dengan endpoint per-paket (delegasi satu seam)
    const batchRes = await packagesRouter.request(`/stock?schoolId=${schoolId}`, { method: "GET" });
    expect(batchRes.status).toBe(200);
    const batchJson = await batchRes.json();
    expect(batchJson.data[pkgId].readyBundleCount).toBe(1);
    expect(batchJson.data[pkgId].maxPossibleBundles).toBe(2);
    expect(batchJson.data[pkgId].looseStockBreakdown.length).toBe(2);

    // 8. schoolId wajib diisi
    const missingRes = await packagesRouter.request("/stock", { method: "GET" });
    expect(missingRes.status).toBe(400);
  });

  it("assembly batch gagal eksplisit saat stok kurang / bongkar berlebih", async () => {
    const stamp = Date.now();
    const schoolId = `test-pkg-fail-${stamp}`;
    const bookId = `b-fail-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Sekolah Gagal Rakit",
      code: `TGF-${stamp}`,
      type: "warehouse",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-FAIL-${stamp}`,
      title: "Buku Langka",
      author: "Test",
      publisher: "Test",
      createdAt: now,
      updatedAt: now,
    });

    const createRes = await packagesRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `PKG-FAIL-${stamp}`,
        name: "Paket Gagal",
        gradeLevel: "1",
        curriculumType: "national",
        academicYear: "2026/2027",
        price: 100000,
        items: [{ bookId, quantity: 2 }],
      }),
    });
    expect(createRes.status).toBe(201);
    const pkgId = (await createRes.json()).data.id;

    // Tanpa stok satuan: rakit 1 (butuh 2) → 400 Insufficient.
    const shortRes = await packagesRouter.request(`/${pkgId}/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, quantity: 1 }),
    });
    expect(shortRes.status).toBe(400);
    expect((await shortRes.json()).message).toMatch(/Insufficient stock/);

    // Tanpa bundel siap: bongkar 1 → 400.
    const overRes = await packagesRouter.request(`/${pkgId}/unbundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, quantity: 1, reason: "uji berlebih" }),
    });
    expect(overRes.status).toBe(400);
    expect((await overRes.json()).message).toMatch(/Not enough assembled/);
  });

  it("DELETE /:id berhasil membongkar bundel in_stock ke stok satuan dan menghapus paket", async () => {
    const stamp = Date.now();
    const schoolId = `test-pkg-del-${stamp}`;
    const bookId = `b-del-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Sekolah Hapus Paket",
      code: `TDL-${stamp}`,
      type: "warehouse",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-DEL-${stamp}`,
      title: "Buku Uji Delete",
      author: "Test",
      publisher: "Test",
      sellPrice: 50000,
      createdAt: now,
      updatedAt: now,
    });

    // Seed 2 unit buku satuan
    await db.insert(bookItems).values([
      {
        id: `bi-del-1-${stamp}`,
        bookId,
        currentSchoolId: schoolId,
        barcode: `BC-DEL-1-${stamp}`,
        condition: "new",
        status: "in_stock",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `bi-del-2-${stamp}`,
        bookId,
        currentSchoolId: schoolId,
        barcode: `BC-DEL-2-${stamp}`,
        condition: "new",
        status: "in_stock",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const createRes = await packagesRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `PKG-DEL-${stamp}`,
        name: "Paket Mau Dihapus",
        gradeLevel: "1",
        curriculumType: "national",
        academicYear: "2026/2027",
        items: [{ bookId, quantity: 2 }],
      }),
    });
    expect(createRes.status).toBe(201);
    const pkgId = (await createRes.json()).data.id;

    // Rakit 1 bundel (menyerap 2 buku)
    const bundleRes = await packagesRouter.request(`/${pkgId}/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, quantity: 1 }),
    });
    expect(bundleRes.status).toBe(200);

    // Hapus paket dengan auto-unbundle
    const delRes = await packagesRouter.request(`/${pkgId}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.success).toBe(true);
    expect(delJson.data.unbundledCount).toBe(1);
    expect(delJson.data.restoredLooseCount).toBe(2);

    // Verifikasi paket sudah tidak ada
    const checkRes = await packagesRouter.request(`/${pkgId}/stock/${schoolId}`, { method: "GET" });
    expect(checkRes.status).toBe(404);
  });

  it("tidak memicu seed demo untuk peran non-pusat saat katalog paket kosong", async () => {
    await db.delete(bookPackageItems);
    await db.delete(packageItems);
    await db.delete(bookPackages);
    try {
      mockActor("school_admin", "school-alw-1");
      const res = await packagesRouter.request("/", { method: "GET" });
      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);

      mockActor("central_admin", null);
      const seeded = await packagesRouter.request("/", { method: "GET" });
      expect(seeded.status).toBe(200);
      expect((await seeded.json()).data.length).toBeGreaterThan(0);
    } finally {
      await runIdempotentSeed();
    }
  });

  it("partitions ready bundles by school in SQL with a 50 cap (§11)", async () => {
    const stamp = Date.now();
    const schoolA = `pkg-ready-a-${stamp}`;
    const schoolB = `pkg-ready-b-${stamp}`;
    const pkgId = `pkg-ready-${stamp}`;
    const now = new Date().toISOString();
    try {
      await db.insert(schools).values([
        { id: schoolA, name: "Ready A", code: `PRA-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
        { id: schoolB, name: "Ready B", code: `PRB-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
      ]);
      await db.insert(bookPackages).values({
        id: pkgId, code: `PKG-READY-${stamp}`, name: "Paket Ready", gradeLevel: "1",
        curriculumType: "national", academicYear: "2026/2027", price: 10000, createdAt: now, updatedAt: now,
      });
      await db.insert(packageItems).values([
        { id: `pi-ready-a-${stamp}`, packageId: pkgId, currentSchoolId: schoolA, barcode: `RDYA-${stamp}`, status: "in_stock", createdAt: now, updatedAt: now },
        { id: `pi-ready-b-${stamp}`, packageId: pkgId, currentSchoolId: schoolB, barcode: `RDYB-${stamp}`, status: "in_stock", createdAt: now, updatedAt: now },
      ]);

      const resA = await packagesRouter.request(`/items/ready?schoolId=${schoolA}`);
      expect(resA.status).toBe(200);
      const idsA = ((await resA.json()) as any).data.map((r: any) => r.id);
      expect(idsA).toContain(`pi-ready-a-${stamp}`);
      expect(idsA).not.toContain(`pi-ready-b-${stamp}`);

      mockActor("school_admin", schoolB);
      const scoped = await packagesRouter.request("/");
      expect(scoped.status).toBe(200);
      const scopedReady = await packagesRouter.request("/items/ready");
      expect(scopedReady.status).toBe(200);
      const idsScoped = ((await scopedReady.json()) as any).data.map((r: any) => r.id);
      expect(idsScoped).toContain(`pi-ready-b-${stamp}`);
      expect(idsScoped).not.toContain(`pi-ready-a-${stamp}`);
    } finally {
      mockActor("central_admin", null);
      await db.delete(packageItems).where(inArray(packageItems.id, [`pi-ready-a-${stamp}`, `pi-ready-b-${stamp}`]));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(schools).where(inArray(schools.id, [schoolA, schoolB]));
    }
  });

  it("creates a 12-line BOM via chunked batch with computed total, listed with BOM in one batched read (T1+T2)", async () => {
    const stamp = Date.now();
    const pkgCode = `PKG-CHUNK-${stamp}`;
    const now = new Date().toISOString();
    const bookIds = Array.from({ length: 12 }, (_, i) => `book-chunk-${stamp}-${i}`);
    try {
      await db.insert(books).values(
        bookIds.map((id, i) => ({
          id,
          isbn: `ISBN-CHUNK-${stamp}-${i}`,
          title: `Chunk Book ${i}`,
          author: "QA",
          publisher: "QA Press",
          sellPrice: 10000 + i * 1000,
          createdAt: now,
          updatedAt: now,
        }))
      );

      const createRes = await packagesRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: pkgCode,
          name: "Paket Chunk",
          gradeLevel: "1",
          curriculumType: "national",
          academicYear: "2026/2027",
          price: 0,
          items: bookIds.map((bookId) => ({ bookId, quantity: 1 })),
        }),
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      const expectedTotal = bookIds.reduce((sum, _, i) => sum + 10000 + i * 1000, 0);
      expect(created.data.price).toBe(expectedTotal);
      const pkgId = created.data.id as string;

      const listRes = await packagesRouter.request("/", { method: "GET" });
      expect(listRes.status).toBe(200);
      const listed = ((await listRes.json()) as { data: Array<{ id: string; items: unknown[]; totalItemsCount: number }> }).data.find(
        (p) => p.id === pkgId
      );
      expect(listed).toBeDefined();
      expect(listed?.items).toHaveLength(12);
      expect(listed?.totalItemsCount).toBe(12);
    } finally {
      const [pkg] = await db.select({ id: bookPackages.id }).from(bookPackages).where(eq(bookPackages.code, pkgCode));
      if (pkg) {
        await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, pkg.id));
        await db.delete(bookPackages).where(eq(bookPackages.id, pkg.id));
      }
      await db.delete(books).where(inArray(books.id, bookIds));
    }
  });
});

