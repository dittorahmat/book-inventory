import { describe, expect, it } from "bun:test";
import { db } from "../../../db";
import { calculateBookDemandSummary, computeBookDemand } from "./demand";
import { createTestSupplier, createTestBook, createTestPackage, createTestStudent } from "../../lib/test-fixtures";
import { SCHOOL_IDS } from "../../lib/school-constants";
import { bookPackageItems, bookSuppliers, students, bookPackages, books, suppliers } from "../../../db/schema";
import { and, eq } from "drizzle-orm";

describe("calculateBookDemandSummary unit tests (#530)", () => {
  it("resolves student demand for supplier books matching student package requirements", async () => {
    const stamp = Date.now();
    const year = "2026/2027";
    const gradeLevel = "9";
    const curriculumType = "INTER";

    const sup = await createTestSupplier(db, {
      id: `sup-unit-demand-${stamp}`,
      code: `SUP-U-${stamp.toString().slice(-4)}`,
      name: "Supplier Unit Demand Test",
    });

    const b = await createTestBook(db, {
      id: `b-unit-dem-${stamp}`,
      isbn: `ISBN-U-DEM-${stamp}`,
      title: "PRIME MATH 1A COURSEBOOK UNIT TEST",
      price: 198600,
      buyPrice: 158880,
    });

    await db.insert(bookSuppliers).values({
      bookId: b.id,
      supplierId: sup.id,
      createdAt: new Date().toISOString(),
    });

    const pkg = await createTestPackage(db, {
      id: `pkg-unit-dem-${stamp}`,
      code: `PKG-U-${stamp}`,
      name: "Paket Demand Unit Test Kelas 9 INTER",
      gradeLevel,
      curriculumType: curriculumType as "international" | "national",
      academicYear: year,
      price: 198600,
    });

    await db.insert(bookPackageItems).values({
      id: `bpi-u-dem-${stamp}`,
      packageId: pkg.id,
      bookId: b.id,
      quantity: 1,
      createdAt: new Date().toISOString(),
    });

    const stu = await createTestStudent(db, {
      id: `std-unit-dem-${stamp}`,
      schoolId: SCHOOL_IDS.ALW_1_HQ,
      nis: `NIS-U-DEM-${stamp}`,
      name: "Student Unit Demand Test",
      gradeLevel,
      curriculumType: "international", // test alias compatibility: international -> INTER
      academicYear: year,
      status: "active",
    });

    try {
      const summary = await calculateBookDemandSummary(db, {
        supplierId: sup.id,
        academicYear: year,
        bufferPercentage: 10,
      });

      expect(summary.academicYear).toBe(year);
      expect(summary.bufferPercentage).toBe(10);
      expect(Array.isArray(summary.proposedItems)).toBe(true);

      const item = summary.proposedItems?.find((p) => p.bookId === b.id);
      expect(item).toBeDefined();
      expect(item?.studentCount).toBe(1);
      // Net demand 1 + 10% buffer = ceil(1 * 1.1) = 2
      expect(item?.quantityOrdered).toBe(2);
      expect(item?.unitPrice).toBe(158880);

      // Verifikasi alias computeBookDemand berfungsi identik di balik seam murni
      const aliasSummary = await computeBookDemand(db, {
        supplierId: sup.id,
        academicYear: year,
        bufferPercentage: 10,
      });
      expect(aliasSummary.proposedItems?.find((p) => p.bookId === b.id)?.quantityOrdered).toBe(2);
    } finally {
      await db.delete(students).where(eq(students.id, stu.id));
      await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, pkg.id));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkg.id));
      await db.delete(bookSuppliers).where(and(eq(bookSuppliers.bookId, b.id), eq(bookSuppliers.supplierId, sup.id)));
      await db.delete(books).where(eq(books.id, b.id));
      await db.delete(suppliers).where(eq(suppliers.id, sup.id));
    }
  });
});
