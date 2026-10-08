import { describe, expect, it } from "bun:test";
import { db } from "../../db";
import {
  bookItems,
  bookPackageItems,
  bookPackages,
  books,
  packageItems,
  schools,
  studentBookOrders,
  students,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { handoverPackage } from "../services/order-fulfilment";
import { assemblePackageBundles, disassemblePackageBundles } from "../services/package-assembly";

const now = new Date().toISOString();
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

async function seedSchool(prefix: string) {
  const id = `sch-ful-${prefix}-${stamp()}`;
  await db.insert(schools).values({
    id, name: `Fulfil ${prefix}`, code: `FUL-${prefix}-${Date.now()}`, type: "branch",
    createdAt: now, updatedAt: now,
  });
  return id;
}

async function seedStudent(schoolId: string) {
  const id = `st-ful-${stamp()}`;
  await db.insert(students).values({
    id, schoolId, nis: `NIS-${id}`, name: "Fulfil Student",
    gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
    status: "active", createdAt: now, updatedAt: now,
  });
  return id;
}

async function seedBook(prefix: string) {
  const id = `b-ful-${prefix}-${stamp()}`;
  await db.insert(books).values({
    id, isbn: `ISBN-FUL-${id}`, title: `Fulfil ${prefix}`, author: "QA", publisher: "QA Press",
    price: 50000, sellPrice: 80000, createdAt: now, updatedAt: now,
  });
  return id;
}

async function seedPackage(prefix: string) {
  const id = `pkg-ful-${prefix}-${stamp()}`;
  await db.insert(bookPackages).values({
    id, code: `PKG-FUL-${prefix}`, name: `Fulfil Pack ${prefix}`, gradeLevel: "1",
    curriculumType: "international", academicYear: "2026/2027", price: 160000,
    createdAt: now, updatedAt: now,
  });
  return id;
}

describe("handoverPackage langsung via seam modul (T5)", () => {
  it("serah terima tanpa stok bundel tetap picked_up dengan assigned null eksplisit", async () => {
    const schoolId = await seedSchool("handnull");
    const studentId = await seedStudent(schoolId);
    const packageId = await seedPackage("handnull");
    const orderId = `ord-ful-${stamp()}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-FUL-${stamp()}`, studentId, schoolId, packageId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 160000, paidAmount: 160000, createdAt: now, updatedAt: now,
      });

      const result = await handoverPackage(db, orderId, { recipientName: "Orang Tua" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.fulfillmentStatus).toBe("picked_up");
        expect(result.data.assignedPackageItemId).toBeNull();
        expect(result.data.deliveryNumber).toContain("SJ-SERAH-");
      }
      const [row] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      expect(row.fulfillmentStatus).toBe("picked_up");
      expect(row.assignedPackageItemId).toBeNull();
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("serah terima mengikat bundel ready dan menandainya delivered", async () => {
    const schoolId = await seedSchool("handok");
    const studentId = await seedStudent(schoolId);
    const packageId = await seedPackage("handok");
    const bundleId = `pi-ful-${stamp()}`;
    const orderId = `ord-ful-${stamp()}`;
    try {
      await db.insert(packageItems).values({
        id: bundleId, packageId, currentSchoolId: schoolId, barcode: `FUL-B-${stamp()}`,
        status: "in_stock", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-FUL-${stamp()}`, studentId, schoolId, packageId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 160000, paidAmount: 160000, createdAt: now, updatedAt: now,
      });

      const result = await handoverPackage(db, orderId, { recipientName: "Orang Tua" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.assignedPackageItemId).toBe(bundleId);
      const [bundle] = await db.select().from(packageItems).where(eq(packageItems.id, bundleId));
      expect(bundle.status).toBe("delivered");
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(packageItems).where(eq(packageItems.id, bundleId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("assemble/disassemble langsung via seam modul (T5)", () => {
  it("rakit 2 bundel lalu bongkar 1: restore setara BOM dan bundel berkurang", async () => {
    const schoolId = await seedSchool("kit");
    const bookId = await seedBook("kit");
    const packageId = await seedPackage("kit");
    const bomId = `bom-ful-${stamp()}`;
    try {
      await db.insert(bookPackageItems).values({
        id: bomId, packageId, bookId, quantity: 2, createdAt: now,
      });
      for (let i = 0; i < 5; i++) {
        await db.insert(bookItems).values({
          id: `bi-kit-${stamp()}-${i}`, bookId, currentSchoolId: schoolId,
          barcode: `KIT-${stamp()}-${i}`, condition: "new", status: "in_stock",
          createdAt: now, updatedAt: now,
        });
      }

      const assembled = await assemblePackageBundles(packageId, schoolId, 2);
      expect(assembled.ok).toBe(true);
      if (!assembled.ok) return;
      expect(assembled.data.quantityAssembled).toBe(2);
      expect(assembled.data.assembledItems).toHaveLength(2);

      const disassembled = await disassemblePackageBundles(packageId, schoolId, 1, "uji restore");
      expect(disassembled.ok).toBe(true);
      if (!disassembled.ok) return;
      expect(disassembled.data.unbundledCount).toBe(1);
      expect(disassembled.data.restoredLooseCount).toBe(2);

      const remaining = await db
        .select({ id: packageItems.id })
        .from(packageItems)
        .where(eq(packageItems.packageId, packageId));
      expect(remaining).toHaveLength(1);
    } finally {
      await db.delete(packageItems).where(eq(packageItems.currentSchoolId, schoolId));
      await db.delete(bookItems).where(eq(bookItems.currentSchoolId, schoolId));
      await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, packageId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("bongkar melebihi stok bundel ditolak 400", async () => {
    const schoolId = await seedSchool("kitshort");
    const packageId = await seedPackage("kitshort");
    try {
      const result = await disassemblePackageBundles(packageId, schoolId, 3, "uji tolak");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
    } finally {
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
