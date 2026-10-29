import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { bookPackages, schools, studentBookOrders, students } from "../../db/schema";
import { WPR_BOOK_ID, WPR_PRICE } from "../../lib/wpr";
import { kitBomWithoutWpr, needsWprForStudent, recalcAllPackagePrices, wprFeeForStudent } from "./pricing";

describe("Pricing seam", () => {
  it("kitBomWithoutWpr strips WPR and keeps priced components", () => {
    const bom = [
      { bookId: WPR_BOOK_ID, quantity: 1 },
      { bookId: "book-mat-1", quantity: 2 },
    ];
    const kit = kitBomWithoutWpr(bom);
    expect(kit.length).toBe(1);
    expect(kit[0].bookId).toBe("book-mat-1");
    expect(kit[0].quantity).toBe(2);
  });

  it("needsWprForStudent true until first package order", async () => {
    const stamp = Date.now();
    const schoolId = `school-pricing-${stamp}`;
    const studentId = `st-pricing-${stamp}`;
    const pkgId = `pkg-pricing-${stamp}`;
    const now = new Date().toISOString();
    try {
      await db.insert(schools).values({
        id: schoolId, name: "Pricing Test", code: `PRC-${stamp}`, type: "branch", createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
      await db.insert(students).values({
        id: studentId, schoolId, nis: `NIS-PRC-${stamp}`, name: "Pricing Kid", gradeLevel: "1",
        curriculumType: "national", academicYear: "2026/2027", status: "active",
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookPackages).values({
        id: pkgId, code: `PKG-PRC-${stamp}`, name: "Paket Pricing", gradeLevel: "1",
        curriculumType: "national", academicYear: "2026/2027", price: 100000, createdAt: now, updatedAt: now,
      });
      expect(await needsWprForStudent(db, studentId)).toBe(true);
      expect(await wprFeeForStudent(db, studentId)).toBe(WPR_PRICE);
      await db.insert(studentBookOrders).values({
        id: `ord-pricing-${stamp}`, orderNumber: `ORD-PRC-${stamp}`, studentId, schoolId,
        packageId: pkgId, createdAt: now, updatedAt: now,
      });
      expect(await needsWprForStudent(db, studentId)).toBe(false);
      expect(await wprFeeForStudent(db, studentId)).toBe(0);

      // recalcAllPackagePrices memperbarui harga paket dari BOM
      const count = await recalcAllPackagePrices(db);
      expect(count).toBeGreaterThan(0);
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.schoolId, schoolId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(schools).where(eq(schools.id, schoolId));
      await db.delete(students).where(inArray(students.schoolId, [schoolId]));
    }
  });
});
