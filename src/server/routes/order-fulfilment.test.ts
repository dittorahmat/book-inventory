import { describe, expect, it } from "bun:test";
import { db } from "../../db";
import {
  bookItems,
  bookPackageItems,
  bookPackages,
  bookReturns,
  books,
  packageItems,
  schools,
  studentBookOrders,
  students,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { resolveReturn, applyDiscretion, cancelStudentOrder } from "../services/order-fulfilment";
import { handoverPackage } from "../services/order-handover";
import { reportReturn } from "../services/return-intake";
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
  it("serah terima tanpa stok bundel ditolak 400 fail-closed", async () => {
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
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.message).toContain("Stok paket tidak tersedia");
      }
      const [row] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      expect(row.fulfillmentStatus).toBe("waiting_preparation");
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

  it("rakit 25 bundel sekaligus tanpa 500: insert ter-chunk (§10 D1 regression)", async () => {
    const schoolId = await seedSchool("kitbulk");
    const bookId = await seedBook("kitbulk");
    const packageId = await seedPackage("kitbulk");
    const bomId = `bom-ful-${stamp()}`;
    try {
      await db.insert(bookPackageItems).values({ id: bomId, packageId, bookId, quantity: 1, createdAt: now });
      await db.insert(bookItems).values(
        Array.from({ length: 25 }, (_, i) => ({
          id: `bi-kitbulk-${stamp()}-${i}`, bookId, currentSchoolId: schoolId,
          barcode: `KITBULK-${stamp()}-${i}`, condition: "new", status: "in_stock",
          createdAt: now, updatedAt: now,
        }))
      );

      const assembled = await assemblePackageBundles(packageId, schoolId, 25);
      expect(assembled.ok).toBe(true);
      if (!assembled.ok) return;
      expect(assembled.data.quantityAssembled).toBe(25);

      const bundles = await db
        .select({ id: packageItems.id })
        .from(packageItems)
        .where(eq(packageItems.packageId, packageId));
      expect(bundles).toHaveLength(25);
    } finally {
      await db.delete(packageItems).where(eq(packageItems.currentSchoolId, schoolId));
      await db.delete(bookItems).where(eq(bookItems.currentSchoolId, schoolId));
      await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, packageId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("stock condition seam regression (T2)", () => {
  it("resolveReturn auto-picks new-only replacement, ignores good/damaged", async () => {
    const schoolId = await seedSchool("retseam");
    const studentId = await seedStudent(schoolId);
    const bookId = await seedBook("retseam");
    const orderId = `ord-ret-${stamp()}`;
    const returnId = `ret-${stamp()}`;
    const newId = `bi-ret-new-${stamp()}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-RET-${stamp()}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "return_in_progress",
        totalAmount: 50000, paidAmount: 50000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values({
        id: newId, bookId, currentSchoolId: schoolId,
        barcode: `RET-NEW-${stamp()}`, condition: "new", status: "in_stock",
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values({
        id: `bi-ret-good-${stamp()}`, bookId, currentSchoolId: schoolId,
        barcode: `RET-GOOD-${stamp()}`, condition: "good", status: "in_stock",
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values({
        id: `bi-ret-dmg-${stamp()}`, bookId, currentSchoolId: schoolId,
        barcode: `RET-DMG-${stamp()}`, condition: "damaged", status: "in_stock",
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: returnId, orderId, studentId, defectiveBookId: bookId,
        reason: "cacat cetak", status: "reported", createdAt: now, updatedAt: now,
      });

      const result = await resolveReturn(db, returnId, { action: "replace" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.replacementBookItemId).toBe(newId);
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, returnId));
      await db.delete(bookItems).where(eq(bookItems.currentSchoolId, schoolId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("assemble rejects good-only stock: kitting requires new via seam", async () => {
    const schoolId = await seedSchool("kitseam");
    const bookId = await seedBook("kitseam");
    const packageId = await seedPackage("kitseam");
    const bomId = `bom-seam-${stamp()}`;
    try {
      await db.insert(bookPackageItems).values({ id: bomId, packageId, bookId, quantity: 1, createdAt: now });
      await db.insert(bookItems).values({
        id: `bi-seam-good-${stamp()}`, bookId, currentSchoolId: schoolId,
        barcode: `SEAM-GOOD-${stamp()}`, condition: "good", status: "in_stock",
        createdAt: now, updatedAt: now,
      });

      const result = await assemblePackageBundles(packageId, schoolId, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
    } finally {
      await db.delete(bookItems).where(eq(bookItems.currentSchoolId, schoolId));
      await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, packageId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("T3 handover explicit-ID guard (stolen/reserved -> 400)", () => {
  it("rejects stolen bundle from another school with 400", async () => {
    const schoolA = await seedSchool("t3a");
    const schoolB = await seedSchool("t3b");
    const packageId = await seedPackage("t3stolen");
    const bundleId = `pi-t3-stolen-${stamp()}`;
    const orderId = `ord-t3-stolen-${stamp()}`;
    try {
      await db.insert(packageItems).values({
        id: bundleId, packageId, currentSchoolId: schoolB, barcode: `T3-STOLEN-${stamp()}`,
        status: "in_stock", createdAt: now, updatedAt: now,
      });
      const studentId = await seedStudent(schoolA);
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T3-${stamp()}`, studentId, schoolId: schoolA, packageId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 160000, paidAmount: 160000, createdAt: now, updatedAt: now,
      });

      const result = await handoverPackage(db, orderId, { recipientName: "Orang Tua", packageItemId: bundleId });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
      const [bundle] = await db.select().from(packageItems).where(eq(packageItems.id, bundleId));
      expect(bundle.status).toBe("in_stock");
      const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      expect(order.fulfillmentStatus).toBe("waiting_preparation");

      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
    } finally {
      await db.delete(packageItems).where(eq(packageItems.id, bundleId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(schools).where(eq(schools.id, schoolA));
      await db.delete(schools).where(eq(schools.id, schoolB));
    }
  });

  it("rejects reserved bundle with 400 via stock-buckets seam", async () => {
    const schoolId = await seedSchool("t3res");
    const studentId = await seedStudent(schoolId);
    const packageId = await seedPackage("t3res");
    const bundleId = `pi-t3-res-${stamp()}`;
    const orderId = `ord-t3-res-${stamp()}`;
    try {
      await db.insert(packageItems).values({
        id: bundleId, packageId, currentSchoolId: schoolId, barcode: `T3-RES-${stamp()}`,
        status: "reserved", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T3-${stamp()}`, studentId, schoolId, packageId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 160000, paidAmount: 160000, createdAt: now, updatedAt: now,
      });

      const result = await handoverPackage(db, orderId, { recipientName: "Orang Tua", packageItemId: bundleId });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
      const [bundle] = await db.select().from(packageItems).where(eq(packageItems.id, bundleId));
      expect(bundle.status).toBe("reserved");
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(packageItems).where(eq(packageItems.id, bundleId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("rejects delivered bundle and unknown id (delivered -> 400, unknown -> 404)", async () => {
    const schoolId = await seedSchool("t3done");
    const studentId = await seedStudent(schoolId);
    const packageId = await seedPackage("t3done");
    const bundleId = `pi-t3-done-${stamp()}`;
    const orderId = `ord-t3-done-${stamp()}`;
    try {
      await db.insert(packageItems).values({
        id: bundleId, packageId, currentSchoolId: schoolId, barcode: `T3-DONE-${stamp()}`,
        status: "delivered", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T3-${stamp()}`, studentId, schoolId, packageId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 160000, paidAmount: 160000, createdAt: now, updatedAt: now,
      });

      const used = await handoverPackage(db, orderId, { recipientName: "X", packageItemId: bundleId });
      expect(used.ok).toBe(false);
      if (!used.ok) expect(used.status).toBe(400);

      const ghost = await handoverPackage(db, orderId, { recipientName: "X", packageItemId: `pi-ghost-${stamp()}` });
      expect(ghost.ok).toBe(false);
      if (!ghost.ok) expect(ghost.status).toBe(404);
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(packageItems).where(eq(packageItems.id, bundleId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("accepts explicit ready bundle and marks it delivered", async () => {
    const schoolId = await seedSchool("t3ok");
    const studentId = await seedStudent(schoolId);
    const packageId = await seedPackage("t3ok");
    const bundleId = `pi-t3-ok-${stamp()}`;
    const orderId = `ord-t3-ok-${stamp()}`;
    try {
      await db.insert(packageItems).values({
        id: bundleId, packageId, currentSchoolId: schoolId, barcode: `T3-OK-${stamp()}`,
        status: "in_stock", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T3-${stamp()}`, studentId, schoolId, packageId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 160000, paidAmount: 160000, createdAt: now, updatedAt: now,
      });

      const result = await handoverPackage(db, orderId, { recipientName: "Orang Tua", packageItemId: bundleId });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.assignedPackageItemId).toBe(bundleId);
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

describe("T3 return state machine (report/resolve share guard, double-resolve idempotent)", () => {
  it("report on non-handed-over order returns 400", async () => {
    const schoolId = await seedSchool("t3rep");
    const studentId = await seedStudent(schoolId);
    const bookId = await seedBook("t3rep");
    const orderId = `ord-t3-rep-${stamp()}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T3-${stamp()}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 50000, paidAmount: 50000, createdAt: now, updatedAt: now,
      });
      const result = await reportReturn(db, {
        orderId, studentId, defectiveBookId: bookId, reason: "robek", source: "staff",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("rejects stolen explicit replacement with 400", async () => {
    const schoolA = await seedSchool("t3ra");
    const schoolB = await seedSchool("t3rb");
    const studentId = await seedStudent(schoolA);
    const bookId = await seedBook("t3repl");
    const orderId = `ord-t3-repl-${stamp()}`;
    const returnId = `ret-t3-repl-${stamp()}`;
    const foreignId = `bi-t3-foreign-${stamp()}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T3-${stamp()}`, studentId, schoolId: schoolA,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "return_in_progress",
        totalAmount: 50000, paidAmount: 50000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values({
        id: foreignId, bookId, currentSchoolId: schoolB,
        barcode: `T3-FOR-${stamp()}`, condition: "new", status: "in_stock",
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: returnId, orderId, studentId, defectiveBookId: bookId,
        reason: "cacat", status: "reported", createdAt: now, updatedAt: now,
      });

      const result = await resolveReturn(db, returnId, { action: "replace", replacementBookItemId: foreignId });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
      const [item] = await db.select().from(bookItems).where(eq(bookItems.id, foreignId));
      expect(item.status).toBe("in_stock");
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, returnId));
      await db.delete(bookItems).where(eq(bookItems.id, foreignId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolA));
      await db.delete(schools).where(eq(schools.id, schoolB));
    }
  });

  it("double-resolve same action is idempotent, cross action is 400", async () => {
    const schoolId = await seedSchool("t3idem");
    const studentId = await seedStudent(schoolId);
    const bookId = await seedBook("t3idem");
    const orderId = `ord-t3-idem-${stamp()}`;
    const returnId = `ret-t3-idem-${stamp()}`;
    const looseId = `bi-t3-idem-${stamp()}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T3-${stamp()}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "return_in_progress",
        totalAmount: 50000, paidAmount: 50000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values({
        id: looseId, bookId, currentSchoolId: schoolId,
        barcode: `T3-IDEM-${stamp()}`, condition: "new", status: "in_stock",
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: returnId, orderId, studentId, defectiveBookId: bookId,
        reason: "cacat", status: "reported", createdAt: now, updatedAt: now,
      });

      const first = await resolveReturn(db, returnId, { action: "replace" });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.data.replacementBookItemId).toBe(looseId);

      const second = await resolveReturn(db, returnId, { action: "replace" });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.replacementBookItemId).toBe(looseId);

      const cross = await resolveReturn(db, returnId, { action: "reject" });
      expect(cross.ok).toBe(false);
      if (!cross.ok) expect(cross.status).toBe(400);

      const [ret] = await db.select().from(bookReturns).where(eq(bookReturns.id, returnId));
      expect(ret.status).toBe("replaced");
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, returnId));
      await db.delete(bookItems).where(eq(bookItems.currentSchoolId, schoolId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("failed report compensates uploaded photo (no orphan) via injected storage", async () => {
    const { MemoryStorageService } = await import("../../services/storage");
    class TrackingStorage extends MemoryStorageService {
      uploads: string[] = [];
      deletes: string[] = [];
      override async upload(key: string, file: Uint8Array | ArrayBuffer | Buffer, contentType: string): Promise<string> {
        this.uploads.push(key);
        return super.upload(key, file, contentType);
      }
      override async delete(key: string): Promise<void> {
        this.deletes.push(key);
        return super.delete(key);
      }
    }
    const schoolId = await seedSchool("t3orphan");
    const studentId = await seedStudent(schoolId);
    const bookId = await seedBook("t3orphan");
    const orderId = `ord-t3-orphan-${stamp()}`;
    const returnId = `ret-t3-orphan-${stamp()}`;
    const storage = new TrackingStorage();
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T3-${stamp()}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "picked_up",
        totalAmount: 50000, paidAmount: 50000, createdAt: now, updatedAt: now,
      });
      const input = {
        orderId, studentId, defectiveBookId: bookId, reason: "robek",
        photoProofBase64: "data:image/jpeg;base64,dGVzdC1mb3RvLXJ1c2Fr", source: "staff" as const,
      };
      const first = await reportReturn(db, input, { storage, generateId: () => returnId });
      expect(first.ok).toBe(true);

      const second = await reportReturn(db, input, { storage, generateId: () => returnId });
      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.status).toBe(400);
      expect(storage.uploads).toHaveLength(2);
      expect(storage.deletes).toHaveLength(1);
      expect(storage.deletes[0]).toBe(storage.uploads[1]);
      expect(await storage.getFile(storage.uploads[1])).toBeNull();
      expect(await storage.getFile(storage.uploads[0])).not.toBeNull();
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, returnId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("spec-57 T2 return-resolution unified interface", () => {
  async function seedReportedReturn(tag: string) {
    const schoolId = await seedSchool(`t2-${tag}`);
    const studentId = await seedStudent(schoolId);
    const bookId = await seedBook(`t2-${tag}`);
    const orderId = `ord-t2-${tag}-${stamp()}`;
    const returnId = `ret-t2-${tag}-${stamp()}`;
    await db.insert(studentBookOrders).values({
      id: orderId, orderNumber: `ORD-T2-${tag}-${stamp()}`, studentId, schoolId,
      orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "picked_up",
      totalAmount: 50000, paidAmount: 50000, createdAt: now, updatedAt: now,
    });
    await db.insert(bookReturns).values({
      id: returnId, orderId, studentId, defectiveBookId: bookId, reason: "robek",
      status: "reported", createdAt: now, updatedAt: now,
    });
    return { schoolId, studentId, bookId, orderId, returnId };
  }
  async function cleanupT2(ctx: { schoolId: string; studentId: string; bookId: string; orderId: string; returnId: string }, itemIds: string[] = []) {
    for (const itemId of itemIds) await db.delete(bookItems).where(eq(bookItems.id, itemId));
    await db.delete(bookReturns).where(eq(bookReturns.id, ctx.returnId));
    await db.delete(studentBookOrders).where(eq(studentBookOrders.id, ctx.orderId));
    await db.delete(students).where(eq(students.id, ctx.studentId));
    await db.delete(books).where(eq(books.id, ctx.bookId));
    await db.delete(schools).where(eq(schools.id, ctx.schoolId));
  }

  it("refund resolves through the guarded interface and restores one stock in one batch", async () => {
    const ctx = await seedReportedReturn("refund");
    try {
      const result = await resolveReturn(db, ctx.returnId, { action: "refund", refundAmount: 25000 }, { now, generateId: () => `bi-t2-refund-${stamp()}` });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.status).toBe("refunded");
      const [ret] = await db.select().from(bookReturns).where(eq(bookReturns.id, ctx.returnId));
      expect(ret.status).toBe("refunded");
      expect(ret.refundAmount).toBe(25000);
      const restored = await db.select().from(bookItems).where(eq(bookItems.bookId, ctx.bookId));
      expect(restored).toHaveLength(1);
      expect(restored[0].status).toBe("in_stock");
      expect(restored[0].currentSchoolId).toBe(ctx.schoolId);
      await cleanupT2(ctx, restored.map((r: { id: string }) => r.id));
    } catch (err) {
      await cleanupT2(ctx);
      throw err;
    }
  });

  it("refund on a terminal return is rejected 400, not rewritten", async () => {
    const ctx = await seedReportedReturn("reflock");
    try {
      await db.update(bookReturns).set({ status: "replaced", updatedAt: now }).where(eq(bookReturns.id, ctx.returnId));
      const result = await resolveReturn(db, ctx.returnId, { action: "refund", refundAmount: 1000 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(400);
      const [ret] = await db.select().from(bookReturns).where(eq(bookReturns.id, ctx.returnId));
      expect(ret.status).toBe("replaced");
      await cleanupT2(ctx);
    } catch (err) {
      await cleanupT2(ctx);
      throw err;
    }
  });

  it("double refund is idempotent without duplicating stock", async () => {
    const ctx = await seedReportedReturn("refidem");
    try {
      const first = await resolveReturn(db, ctx.returnId, { action: "refund", refundAmount: 5000 }, { now, generateId: () => `bi-t2-idem-${stamp()}` });
      expect(first.ok).toBe(true);
      const second = await resolveReturn(db, ctx.returnId, { action: "refund", refundAmount: 5000 });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.status).toBe("refunded");
      const restored = await db.select().from(bookItems).where(eq(bookItems.bookId, ctx.bookId));
      expect(restored).toHaveLength(1);
      await cleanupT2(ctx, restored.map((r: { id: string }) => r.id));
    } catch (err) {
      await cleanupT2(ctx);
      throw err;
    }
  });

  it("discretion discount recomputes total and keeps paid when covered", async () => {
    const schoolId = await seedSchool("t2-disc");
    const studentId = await seedStudent(schoolId);
    const orderId = `ord-t2-disc-${stamp()}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T2-DISC-${stamp()}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "partial", fulfillmentStatus: "picked_up",
        totalAmount: 100000, paidAmount: 100000, createdAt: now, updatedAt: now,
      });
      const result = await applyDiscretion(db, orderId, { discretionType: "discount", discountAmount: 20000, discretionNotes: "anak guru" }, { now });
      expect(result.ok).toBe(true);
      const [row] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      expect(row.totalAmount).toBe(80000);
      expect(row.paymentStatus).toBe("paid");
      expect(row.discretionType).toBe("discount");
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("discretion scholarship zeroes total and approves handover", async () => {
    const schoolId = await seedSchool("t2-scho");
    const studentId = await seedStudent(schoolId);
    const orderId = `ord-t2-scho-${stamp()}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T2-SCHO-${stamp()}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "picked_up",
        totalAmount: 100000, paidAmount: 0, createdAt: now, updatedAt: now,
      });
      const result = await applyDiscretion(db, orderId, { discretionType: "scholarship", discretionNotes: "beasiswa penuh" }, { now });
      expect(result.ok).toBe(true);
      const [row] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      expect(row.totalAmount).toBe(0);
      expect(row.orderType).toBe("scholarship");
      expect(row.paymentStatus).toBe("scholarship_approved");
      expect(row.financeHandoverApproved).toBe(true);
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("cancel restores the bundle and removes returns plus order atomically", async () => {
    const schoolId = await seedSchool("t2-cancel");
    const studentId = await seedStudent(schoolId);
    const packageId = await seedPackage("t2cancel");
    const bundleId = `pi-t2-cancel-${stamp()}`;
    const orderId = `ord-t2-cancel-${stamp()}`;
    const returnId = `ret-t2-cancel-${stamp()}`;
    const bookId = await seedBook("t2cancel");
    try {
      await db.insert(packageItems).values({
        id: bundleId, packageId, currentSchoolId: schoolId, barcode: `T2C-${stamp()}`,
        status: "delivered", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-T2-CANCEL-${stamp()}`, studentId, schoolId, packageId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "picked_up",
        totalAmount: 160000, paidAmount: 160000, assignedPackageItemId: bundleId,
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: returnId, orderId, studentId, defectiveBookId: bookId, reason: "robek",
        status: "reported", createdAt: now, updatedAt: now,
      });
      const result = await cancelStudentOrder(db, orderId, { now });
      expect(result.ok).toBe(true);
      const [bundle] = await db.select().from(packageItems).where(eq(packageItems.id, bundleId));
      expect(bundle.status).toBe("in_stock");
      expect(await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId))).toHaveLength(0);
      expect(await db.select().from(bookReturns).where(eq(bookReturns.id, returnId))).toHaveLength(0);
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, returnId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(packageItems).where(eq(packageItems.id, bundleId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
