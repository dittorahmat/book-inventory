import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { demoRouter } from "./demo";
import { db } from "../../db";
import {
  bookItems,
  books,
  bookPackages,
  bookPackageItems,
  branchCharges,
  internalShipments,
  paymentReceipts,
  students,
  studentBookOrders,
  suppliers,
  purchaseOrders,
  schools,
  systemSettings,
  users,
} from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { DEMO_STOCK_OVERRIDE_KEY, setDemoStockOverrideEnabled } from "../services/demo-stock-override";
import { createTestBook, createTestPackage, createTestSchool } from "../lib/test-fixtures";

const SEEDED_PACKAGE_IDS = ["pkg-sd1-int", "pkg-sd1-nas", "pkg-sd2-int", "pkg-sd2-nas"];

describe("Revamped Demo Seeding API", () => {
  it("seeds full operational school environment with students, packages, suppliers, and order scenarios", async () => {
    const res = await demoRouter.request("/seed", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.schoolsSeeded).toBe(5);
    expect(json.data.booksSeeded).toBe(12);
    expect(json.data.packagesSeeded).toBe(4);
    expect(json.data.studentsSeeded).toBe(8);
    expect(json.data.demoPack).toBe(true);
    expect(json.data.pack).toEqual({
      internalPurchaseOrders: 2,
      internalShipments: 5,
      transferShipments: 3,
      vendorReturns: 1,
      branchCharges: 6,
      branchClaims: 2,
      termReconciliations: 1,
      uniformRejects: 1,
    });

    // 1. Verify Al Wildan HQ
    const [hq] = await db.select().from(schools).where(eq(schools.id, "school-alw-1"));
    expect(hq).toBeDefined();
    expect(hq.type).toBe("main");

    // 1b. Verify single logistics warehouse
    const [warehouse] = await db.select().from(schools).where(eq(schools.id, "school-warehouse"));
    expect(warehouse).toBeDefined();
    expect(warehouse.type).toBe("warehouse");

    // 2. Verify Hendra Wahyudi (promoted to grade 2)
    const [hendra] = await db.select().from(students).where(eq(students.name, "Hendra Wahyudi"));
    expect(hendra).toBeDefined();
    expect(hendra.status).toBe("promoted");

    // 3. Verify packages exist
    const pkgs = await db.select().from(bookPackages);
    expect(pkgs.length).toBeGreaterThanOrEqual(3);

    // 4. Verify realistic orders
    const orders = await db.select().from(studentBookOrders);
    expect(orders.length).toBeGreaterThanOrEqual(4);

    // 5. Verify supplier and purchase order
    const [sup] = await db.select().from(suppliers).where(eq(suppliers.code, "SUP-ERL"));
    expect(sup).toBeDefined();

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, "PO-202609-0088"));
    expect(po).toBeDefined();
    expect(po.status).toBe("partially_received");
  });

  it("menjaga konsistensi data demo: harga beli/jual buku dan harga paket terkomputasi", async () => {
    await demoRouter.request("/seed", { method: "POST" });

    // 1. Setiap buku demo punya harga beli & harga jual (model harga fase 2).
    const demoBooks = await db
      .select()
      .from(books)
      .where(inArray(books.id, ["b-math-1", "b-sci-1", "b-eng-1", "b-pai-2", "b-bindo-1"]));
    expect(demoBooks.length).toBeGreaterThan(0);
    for (const b of demoBooks) {
      expect(b.buyPrice).toBeGreaterThan(0);
      expect(b.sellPrice).toBeGreaterThan(0);
    }

    // 2. Harga paket = jumlah harga jual komponen (bukan input manual).
    for (const packageId of SEEDED_PACKAGE_IDS) {
      const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, packageId));
      expect(pkg).toBeDefined();

      const components: Array<{ quantity: number; price: number; sellPrice: number }> = await db
        .select({
          quantity: bookPackageItems.quantity,
          price: books.price,
          sellPrice: books.sellPrice,
        })
        .from(bookPackageItems)
        .innerJoin(books, eq(bookPackageItems.bookId, books.id))
        .where(eq(bookPackageItems.packageId, packageId));

      expect(components.length).toBeGreaterThan(0);
      const expected = components.reduce(
        (sum, c) => sum + effectiveSellPrice(c) * c.quantity,
        0
      );
      expect(pkg.price).toBe(expected);
    }

    // 3. Demo admin gudang adalah central admin dan tertunjuk ke lokasi gudang.
    const [gudang] = await db.select().from(users).where(eq(users.email, "admin.gudang@alwildan.sch.id"));
    expect(gudang).toBeDefined();
    expect(gudang.role).toBe("central_admin");
    const [warehouse] = await db.select().from(schools).where(eq(schools.type, "warehouse"));
    expect(gudang.schoolId).toBe(warehouse.id);

    // 3b. Demo admin ALW-1 terkunci sebagai school admin di lokasinya.
    const [pusat] = await db.select().from(users).where(eq(users.email, "admin.pusat@alwildan.sch.id"));
    expect(pusat).toBeDefined();
    expect(pusat.role).toBe("school_admin");
    expect(pusat.schoolId).toBe("school-alw-1");
  });

  it("kredensial demo terverifikasi scrypt (login password123 tidak 401)", async () => {
    const { verifyPassword } = await import("better-auth/crypto");
    const { accounts } = await import("../../db/schema");
    const [acc] = await db.select().from(accounts).where(eq(accounts.id, "acc-usr-admin-gudang"));
    expect(acc).toBeDefined();
    expect(await verifyPassword({ hash: acc.password as string, password: "password123" })).toBe(true);
  });

  it("accountId kredensial = user id (konvensi sign-in better-auth)", async () => {
    const { accounts } = await import("../../db/schema");
    const rows = await db.select().from(accounts).where(inArray(accounts.id, ["acc-usr-admin-gudang", "acc-usr-admin-pusat"]));
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.accountId).toBe(row.userId);
      expect(row.providerId).toBe("credential");
    }
  });

  it("seed demo idempoten: pemanggilan kedua tidak menambah baris", async () => {
    const countRows = async () => ({
      schools: (await db.select().from(schools)).length,
      students: (await db.select().from(students)).length,
      orders: (await db.select().from(studentBookOrders)).length,
      loose: (await db.select().from(bookItems)).length,
      suppliers: (await db.select().from(suppliers)).length,
      shipments: (await db.select().from(internalShipments)).length,
      charges: (await db.select().from(branchCharges)).length,
      receipts: (await db.select().from(paymentReceipts)).length,
    });

    expect((await demoRouter.request("/seed", { method: "POST" })).status).toBe(200);
    const before = await countRows();
    expect((await demoRouter.request("/seed", { method: "POST" })).status).toBe(200);
    const after = await countRows();
    expect(after).toEqual(before);
  });

  it("re-seed mengembalikan state demo yang diubah operator", async () => {
    expect((await demoRouter.request("/seed", { method: "POST" })).status).toBe(200);
    const stamp = new Date().toISOString();
    await db.update(paymentReceipts).set({ verifiedAt: stamp }).where(eq(paymentReceipts.id, "rcp-zaki-02"));
    await db.update(students).set({ status: "active" }).where(eq(students.id, "std-alw3-03"));

    expect((await demoRouter.request("/seed", { method: "POST" })).status).toBe(200);

    const [receipt] = await db.select().from(paymentReceipts).where(eq(paymentReceipts.id, "rcp-zaki-02"));
    expect(receipt.verifiedAt).toBeNull();
    const [promoted] = await db.select().from(students).where(eq(students.id, "std-alw3-03"));
    expect(promoted.status).toBe("promoted");
  });

  it("POST /stock/book-override & /stock/package-override guards demo mode and sets stock", async () => {
    await db.delete(systemSettings).where(eq(systemSettings.key, DEMO_STOCK_OVERRIDE_KEY));
    const s = await createTestSchool(db);
    const b = await createTestBook(db);
    const p = await createTestPackage(db);

    // 1. Ditolak jika mode demo nonaktif (403)
    const denyBook = await demoRouter.request("/stock/book-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: s.id, bookId: b.id, targetQuantity: 20 }),
    });
    expect(denyBook.status).toBe(403);

    // 2. Aktifkan mode demo
    await setDemoStockOverrideEnabled(db, true);

    // 3. Set stok buku satuan
    const okBook = await demoRouter.request("/stock/book-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: s.id, bookId: b.id, targetQuantity: 42 }),
    });
    expect(okBook.status).toBe(200);
    const bookJson = await okBook.json();
    expect(bookJson.success).toBe(true);
    expect(bookJson.data.newQuantity).toBe(42);

    // 4. Set stok paket
    const okPkg = await demoRouter.request("/stock/package-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: s.id, packageId: p.id, targetQuantity: 15 }),
    });
    expect(okPkg.status).toBe(200);
    const pkgJson = await okPkg.json();
    expect(pkgJson.success).toBe(true);
    expect(pkgJson.data.newQuantity).toBe(15);

    // 5. Set stok seragam varian
    const stamp = Date.now().toString().slice(-6);
    const uvId = `uv-test-${stamp}`;
    const upkgId = `up-test-${stamp}`;
    const { uniformVariants, uniformPackages } = await import("../../db/schema");
    await db.insert(uniformVariants).values({
      id: uvId,
      code: `UV-TEST-${stamp}`,
      name: "Seragam Uji",
      kind: "olahraga",
      gender: "male",
      jenjang: "sd",
      academicYear: "2026/2027",
      price: 120000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.insert(uniformPackages).values({
      id: upkgId,
      code: `UP-TEST-${stamp}`,
      name: "Paket Seragam Uji",
      academicYear: "2026/2027",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const okUniform = await demoRouter.request("/stock/uniform-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: uvId, size: "L", targetQuantity: 33 }),
    });
    expect(okUniform.status).toBe(200);
    const uniformJson = await okUniform.json();
    expect(uniformJson.success).toBe(true);
    expect(uniformJson.data.newQuantity).toBe(33);

    // 6. Set stok paket seragam
    const okUniformPkg = await demoRouter.request("/stock/uniform-package-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: upkgId, targetQuantity: 21 }),
    });
    expect(okUniformPkg.status).toBe(200);
    const unifPkgJson = await okUniformPkg.json();
    expect(unifPkgJson.success).toBe(true);
    expect(unifPkgJson.data.newQuantity).toBe(21);
  });
});
