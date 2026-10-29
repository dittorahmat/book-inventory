import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bookPackages,
  packageItems,
  paymentAllocations,
  paymentReceipts,
  studentBookOrders,
  studentOrderItems,
  students,
} from "../../db/schema";
import { seedDemoBooks } from "./demo-books";

const now = new Date().toISOString();

describe("seed demo: fondasi order buku", () => {
  it("menyelaraskan total order dengan harga paket dan menyerahkan bundel Aisyah", async () => {
    await seedDemoBooks({ db, now });

    const orders = await db
      .select()
      .from(studentBookOrders)
      .where(eq(studentBookOrders.schoolId, "school-alw-1"));
    const byId = new Map(orders.map((order) => [order.id, order]));
    const packages = await db.select().from(bookPackages);
    const price = new Map(packages.map((pkg) => [pkg.id, pkg.price]));

    expect(byId.get("ord-aisyah-done")?.totalAmount).toBe(price.get("pkg-sd1-int") ?? 0);
    expect(byId.get("ord-aisyah-done")?.paidAmount).toBe(price.get("pkg-sd1-int") ?? 0);
    expect(byId.get("ord-zaki-partial")?.totalAmount).toBe(price.get("pkg-sd1-nas"));
    expect(byId.get("ord-zaki-partial")?.paidAmount).toBe(500000);
    expect(byId.get("ord-hendra-unpaid")?.totalAmount).toBe(price.get("pkg-sd2-int"));

    const [receipt] = await db.select().from(paymentReceipts).where(eq(paymentReceipts.id, "rcp-aisyah-1"));
    expect(receipt.amount).toBe(price.get("pkg-sd1-int") ?? 0);
    const [allocation] = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.id, "rcp-aisyah-1-buku-ord-aisyah-done"));
    expect(allocation.amount).toBe(price.get("pkg-sd1-int") ?? 0);

    const [bundle] = await db.select().from(packageItems).where(eq(packageItems.id, "pki-sd1int-0"));
    expect(bundle.status).toBe("delivered");
    expect(byId.get("ord-aisyah-done")?.assignedPackageItemId).toBe(bundle.id);

    const [aisyah] = await db.select().from(students).where(eq(students.id, "std-aisyah-2"));
    expect(aisyah.hasTakenPackage).toBe(true);
    expect(aisyah.packageReceivedAt).not.toBeNull();

    const [zaidan] = await db.select().from(students).where(eq(students.id, "std-zaidan-pending"));
    expect(zaidan.status).toBe("new_pending");

    expect(byId.get("ord-kayla-paid")?.totalAmount).toBe(price.get("pkg-sd2-int") ?? 0);
    expect(byId.get("ord-kayla-paid")?.paymentStatus).toBe("paid");
    expect(byId.get("ord-salsa-loose")?.totalAmount).toBe(1000000);
    expect(byId.get("ord-salsa-loose")?.homeAddressSnapshot).toContain("RT 03 RW 04");

    const items = await db
      .select()
      .from(studentOrderItems)
      .where(eq(studentOrderItems.orderId, "ord-salsa-loose"));
    expect(items).toHaveLength(3);
    expect(items.reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0)).toBe(1000000);
  });
});
