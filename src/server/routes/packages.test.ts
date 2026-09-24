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
  });
});
