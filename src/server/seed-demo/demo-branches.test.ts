import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bookItems,
  bookPackages,
  paymentAllocations,
  paymentReceipts,
  studentBookOrders,
  students,
} from "../../db/schema";
import { seedDemoBranches } from "./demo-branches";

const now = new Date().toISOString();

describe("seed demo: multi-kampus", () => {
  it("mengisi siswa, stok, order, dan direct sale tanpa bocor antar kampus", async () => {
    await seedDemoBranches({ db, now });

    for (const schoolId of ["school-alw-2", "school-alw-3", "school-alw-4"]) {
      const branchStudents = await db.select().from(students).where(eq(students.schoolId, schoolId));
      expect(branchStudents).toHaveLength(3);
    }

    const packages = await db.select().from(bookPackages);
    const price = new Map(packages.map((pkg) => [pkg.id, pkg.price]));
    const orders = await db.select().from(studentBookOrders);
    const byId = new Map(orders.map((order) => [order.id, order]));

    expect(byId.get("ord-alw2-paid")?.paymentStatus).toBe("paid");
    expect(byId.get("ord-alw2-paid")?.totalAmount).toBe(price.get("pkg-sd2-int") ?? 0);
    expect(byId.get("ord-alw3-partial")?.paymentStatus).toBe("partial");
    expect(byId.get("ord-alw3-partial")?.paidAmount).toBe(700000);
    expect(byId.get("ord-alw4-unpaid")?.paymentStatus).toBe("unpaid");

    const [receipt] = await db.select().from(paymentReceipts).where(eq(paymentReceipts.id, "rcp-alw3-1"));
    expect(receipt.verifiedAt).not.toBeNull();
    const [allocation] = await db.select().from(paymentAllocations).where(eq(paymentAllocations.id, "alc-alw3-1"));
    expect(allocation.amount).toBe(700000);

    const [directOrder] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, "ord-direct-demo-1"));
    expect(directOrder.paymentStatus).toBe("paid");
    const [directReceipt] = await db.select().from(paymentReceipts).where(eq(paymentReceipts.id, "rcp-direct-demo-1"));
    expect(directReceipt.bankName).toBe("KAS TUNAI");

    const damaged = await db.select().from(bookItems).where(eq(bookItems.condition, "damaged"));
    const lost = await db.select().from(bookItems).where(eq(bookItems.status, "lost"));
    expect(damaged.length).toBeGreaterThanOrEqual(3);
    expect(lost.length).toBeGreaterThanOrEqual(2);

    const branchStock = await db.select().from(bookItems).where(eq(bookItems.currentSchoolId, "school-alw-2"));
    expect(branchStock.every((item) => item.currentSchoolId === "school-alw-2")).toBe(true);
  });
});
