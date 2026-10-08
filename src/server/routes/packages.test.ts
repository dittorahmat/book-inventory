import { describe, expect, it } from "bun:test";
import { packagesRouter } from "./packages";
import { db } from "../../db";
import { schools, books, bookItems } from "../../db/schema";

describe("Packages & Bundling/Unbundling API", () => {
  it("creates a package, checks stock potential, bundles and unbundles items", async () => {
    const schoolId = `test-pkg-school-${Date.now()}`;
    const bookId1 = `test-pkg-book-1-${Date.now()}`;
    const bookId2 = `test-pkg-book-2-${Date.now()}`;
    const pkgCode = `PKG-TEST-${Date.now()}`;
    const now = new Date().toISOString();

    // 1. Setup school & books
    await db.insert(schools).values({
      id: schoolId,
      name: "Test Package School",
      code: `TPS-${Date.now()}`,
      type: "branch",
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
      type: "branch",
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
      type: "branch",
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
});

