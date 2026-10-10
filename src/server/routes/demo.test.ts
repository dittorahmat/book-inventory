import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { auth } from "../auth";

const realGetSession = auth.api.getSession;
function actAs(role: "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin" | null, schoolId: string | null = null) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-test", role, schoolId } } as any) : null;
}
beforeEach(() => actAs("central_admin", null));
afterEach(() => {
  (auth.api as any).getSession = realGetSession;
});
import { demoRouter } from "./demo";
import { db } from "../../db";
import {
  books,
  bookPackages,
  bookPackageItems,
  students,
  studentBookOrders,
  suppliers,
  purchaseOrders,
  schools,
  users,
} from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { effectiveSellPrice } from "../../lib/book-pricing";

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
});
