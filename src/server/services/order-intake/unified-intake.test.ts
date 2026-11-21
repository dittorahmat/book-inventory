import { describe, expect, it } from "bun:test";
import { db } from "../../../db";
import { submitOrder } from "./unified-intake";
import { createTestStudent, createTestBook, createTestPackage } from "../../lib/test-fixtures";
import { SCHOOL_IDS } from "../../lib/school-constants";
import { students, bookPackages, books, studentBookOrders } from "../../../db/schema";
import { eq } from "drizzle-orm";

describe("Unified Order Intake Seam (submitOrder)", () => {
  it("processes book order via unified discriminated union payload", async () => {
    const stamp = Date.now();
    const stu = await createTestStudent(db, {
      id: `std-uni-intake-${stamp}`,
      schoolId: SCHOOL_IDS.ALW_1_HQ,
      nis: `NIS-UNI-${stamp}`,
      name: "Student Unified Intake Test",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
    });

    const b = await createTestBook(db, {
      id: `b-uni-intake-${stamp}`,
      isbn: `ISBN-UNI-${stamp}`,
      title: "Buku Unified Intake Test",
      price: 50000,
      sellPrice: 50000,
    });

    const pkg = await createTestPackage(db, {
      id: `pkg-uni-intake-${stamp}`,
      code: `PKG-UNI-${stamp}`,
      name: "Paket Unified Intake",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 50000,
    });

    try {
      const result = await submitOrder(db, {
        type: "book",
        studentId: stu.id,
        packageId: pkg.id,
        orderType: "regular",
        payment: {
          transferAmount: 50000,
          allocationAmount: 50000,
          bankName: "BCA",
          referenceNumber: `REF-${stamp}`,
          paymentProofBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          transferDate: new Date().toISOString().slice(0, 10),
        },
      });

      expect(result.type).toBe("book");
      if (result.type === "book") {
        if (!result.ok) {
          console.error("FAIL MSG 2:", result.status, result.message);
        }
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.order.orderNumber).toBeDefined();
          await db.delete(studentBookOrders).where(eq(studentBookOrders.id, result.data.order.id));
        }
      }
    } finally {
      await db.delete(students).where(eq(students.id, stu.id));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkg.id));
      await db.delete(books).where(eq(books.id, b.id));
    }
  });
});
