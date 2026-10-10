import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { booksRouter } from "./books";
import { packagesRouter } from "./packages";
import { procurementRouter } from "./procurement";
import { mockActor, restoreActor } from "./test-actor";
import { db } from "../../db";
import { schools, books, bookPackages, bookPackageItems, suppliers, purchaseOrders } from "../../db/schema";
import { eq } from "drizzle-orm";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});

/** PO selalu diarahkan ke Gudang Logistik (design D1), jadi test tidak perlu lokasi sekolah. */
async function warehouseId(): Promise<string> {
  const [warehouse] = await db.select({ id: schools.id }).from(schools).where(eq(schools.type, "warehouse")).limit(1);
  if (!warehouse) throw new Error("Lokasi gudang belum tersedia. Jalankan seed terlebih dahulu.");
  return warehouse.id;
}

async function seedBook(prefix: string, sell: number, buy: number) {
  const res = await booksRouter.request("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      isbn: `ISBN-PRICE-${prefix}-${Date.now()}`,
      title: `Pricing Book ${prefix}`,
      author: "Tester",
      publisher: "Test Press",
      price: sell,
      sellPrice: sell,
      buyPrice: buy,
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).data as { id: string };
}

describe("Book pricing & computed package price (spec: book-pricing)", () => {
  it("stores two prices and recalculates all consuming packages on sell price change", async () => {
    // Buku A harga jual 30000, Buku B harga jual 50000
    const bookA = await seedBook("a", 30000, 25000);
    const bookB = await seedBook("b", 50000, 40000);

    // Paket 1 memakai buku A + B -> total otomatis 80000
    const pkg1Res = await packagesRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `PKG-R1-${Date.now()}`,
        name: "Paket Recalc 1",
        gradeLevel: "1",
        academicYear: "2026/2027",
        price: 1, // input manual diabaikan, harga terkomputasi
        items: [
          { bookId: bookA.id, quantity: 1 },
          { bookId: bookB.id, quantity: 1 },
        ],
      }),
    });
    expect(pkg1Res.status).toBe(201);
    const pkg1 = (await pkg1Res.json()).data;
    expect(pkg1.price).toBe(80000);

    // Paket 2 hanya memakai buku A -> total 30000
    const pkg2Res = await packagesRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `PKG-R2-${Date.now()}`,
        name: "Paket Recalc 2",
        gradeLevel: "2",
        academicYear: "2026/2027",
        items: [{ bookId: bookA.id, quantity: 2 }],
      }),
    });
    expect(pkg2Res.status).toBe(201);
    const pkg2 = (await pkg2Res.json()).data;
    expect(pkg2.price).toBe(60000);

    // Ubah harga jual buku A 30000 -> 35000; kedua paket dihitung ulang
    const patchRes = await booksRouter.request(`/${bookA.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellPrice: 35000 }),
    });
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.data.sellPrice).toBe(35000);
    expect(patchJson.message).toContain("2 paket");

    const [p1] = await db.select().from(bookPackages).where(eq(bookPackages.id, pkg1.id));
    const [p2] = await db.select().from(bookPackages).where(eq(bookPackages.id, pkg2.id));
    expect(p1.price).toBe(85000); // 35000 + 50000
    expect(p2.price).toBe(70000); // 35000 * 2

    // Buku lama tanpa harga terpisah: fallback membaca harga lama
    const legacyRes = await booksRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isbn: `ISBN-LEGACY-${Date.now()}`,
        title: "Legacy Book",
        author: "Old",
        publisher: "Old Press",
        price: 42000,
      }),
    });
    const legacy = (await legacyRes.json()).data;
    expect(legacy.buyPrice).toBe(42000);
    expect(legacy.sellPrice).toBe(42000);

    // Cleanup
    await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, pkg1.id));
    await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, pkg2.id));
    await db.delete(bookPackages).where(eq(bookPackages.id, pkg1.id));
    await db.delete(bookPackages).where(eq(bookPackages.id, pkg2.id));
    await db.delete(books).where(eq(books.id, bookA.id));
    await db.delete(books).where(eq(books.id, bookB.id));
    await db.delete(books).where(eq(books.id, legacy.id));
  });

  it("defaults PO item unit price from the book buy price when omitted", async () => {
    const schoolId = await warehouseId();
    const book = await seedBook("podef", 55000, 40000);

    const supRes = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-PODEF-${Date.now()}`, name: "Supplier Default Harga" }),
    });
    expect(supRes.status).toBe(201);
    const supplierId = (await supRes.json()).data.id;

    const poRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        targetSchoolId: schoolId,
        orderDate: "2026-09-30",
        items: [{ bookId: book.id, quantityOrdered: 10 }],
      }),
    });
    expect(poRes.status).toBe(201);
    const po = (await poRes.json()).data;
    expect(po.items[0].unitPrice).toBe(40000); // harga beli efektif
    expect(po.totalAmount).toBe(400000);
    expect(po.subtotalGross).toBe(400000);
    expect(po.discountTotal).toBe(0);

    // Cleanup
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, po.id));
    await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    await db.delete(books).where(eq(books.id, book.id));
  });
});

describe("PO item discount & three header totals (spec: po-item-discount)", () => {
  it("computes 100 x 50000 with 10% discount as net 4500000 and rejects 150%", async () => {
    const schoolId = await warehouseId();
    const book = await seedBook("disc", 60000, 50000);

    const supRes = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: `SUP-DISC-${Date.now()}`, name: "Supplier Diskon" }),
    });
    const supplierId = (await supRes.json()).data.id;

    const poRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        targetSchoolId: schoolId,
        orderDate: "2026-09-30",
        items: [
          { bookId: book.id, quantityOrdered: 100, unitPrice: 50000, discountPercent: 10 },
        ],
      }),
    });
    expect(poRes.status).toBe(201);
    const po = (await poRes.json()).data;
    expect(po.subtotalGross).toBe(5000000);
    expect(po.discountTotal).toBe(500000);
    expect(po.totalAmount).toBe(4500000);

    // Tiga angka tampil pada daftar PO
    const listRes = await procurementRouter.request("/purchase-orders", { method: "GET" });
    const listed = (await listRes.json()).data.find((p: any) => p.id === po.id);
    expect(listed.subtotalGross).toBe(5000000);
    expect(listed.discountTotal).toBe(500000);
    expect(listed.totalAmount).toBe(4500000);
    expect(listed.items[0].discountPercent).toBe(10);

    // Diskon 150 persen ditolak validasi (zod error -> 400)
    const badRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        targetSchoolId: schoolId,
        orderDate: "2026-09-30",
        items: [
          { bookId: book.id, quantityOrdered: 1, unitPrice: 1000, discountPercent: 150 },
        ],
      }),
    });
    expect(badRes.status).toBe(400);

    // Diskon negatif ditolak
    const negRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        targetSchoolId: schoolId,
        orderDate: "2026-09-30",
        items: [
          { bookId: book.id, quantityOrdered: 1, unitPrice: 1000, discountPercent: -5 },
        ],
      }),
    });
    expect(negRes.status).toBe(400);

    // Diskon 0 = tanpa diskon, netto = kotor
    const zeroRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        targetSchoolId: schoolId,
        orderDate: "2026-09-30",
        items: [
          { bookId: book.id, quantityOrdered: 2, unitPrice: 25000, discountPercent: 0 },
        ],
      }),
    });
    expect(zeroRes.status).toBe(201);
    const zeroPo = (await zeroRes.json()).data;
    expect(zeroPo.subtotalGross).toBe(50000);
    expect(zeroPo.discountTotal).toBe(0);
    expect(zeroPo.totalAmount).toBe(50000);

    // Cleanup
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, po.id));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, zeroPo.id));
    await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    await db.delete(books).where(eq(books.id, book.id));
  });
});
