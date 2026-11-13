import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bookPackages,
  packageItems,
  schools,
  studentBookOrders,
  students,
  uniformOrderItems,
  uniformOrders,
  uniformStock,
  uniformVariants,
} from "../../db/schema";
import { createTestBookOrder, createTestSchool, createTestStudent } from "../lib/test-fixtures";
import {
  isBookOrderPending,
  isUniformOrderPending,
  supersedeBookOrder,
  supersedeUniformOrder,
} from "./order-supersede";

describe("order-supersede seam", () => {
  it("supersedes pending book order and releases allocated bundle to in_stock", async () => {
    const stamp = `bko_${Date.now()}`;
    const school = await createTestSchool(db, { id: `sch_${stamp}` });
    const student = await createTestStudent(db, { id: `std_${stamp}`, schoolId: school.id });
    const bundleId = `pki_${stamp}`;
    const orderId = `ord_${stamp}`;
    const now = new Date().toISOString();

    const packageId = `pkg_${stamp}`;
    try {
      await db.insert(bookPackages).values({
        id: packageId,
        code: `PKG-${stamp}`,
        name: `Paket SD ${stamp}`,
        gradeLevel: "1",
        academicYear: "2026/2027",
        price: 150000,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(packageItems).values({
        id: bundleId,
        packageId,
        currentSchoolId: school.id,
        barcode: `PKG-BC-${stamp}`,
        status: "reserved",
        createdAt: now,
        updatedAt: now,
      });

      await createTestBookOrder(db, {
        id: orderId,
        orderNumber: `ORD-${stamp}`,
        studentId: student.id,
        schoolId: school.id,
        paymentStatus: "unpaid",
        fulfillmentStatus: "ready_for_pickup",
        totalAmount: 150000,
        paidAmount: 0,
        assignedPackageItemId: bundleId,
      });

      expect(isBookOrderPending({ fulfillmentStatus: "ready_for_pickup" })).toBe(true);

      const res = await supersedeBookOrder(db, {
        orderId,
        supersededByOrderId: `ord_new_${stamp}`,
      });

      expect(res.ok).toBe(true);
      expect(res.orderId).toBe(orderId);

      // Verifikasi status order berubah ke superseded & unassigned
      const [updatedOrder] = await db
        .select()
        .from(studentBookOrders)
        .where(eq(studentBookOrders.id, orderId));
      expect(updatedOrder.fulfillmentStatus).toBe("superseded");
      expect(updatedOrder.assignedPackageItemId).toBeNull();
      expect(updatedOrder.supersededByOrderId).toBe(`ord_new_${stamp}`);

      // Verifikasi bundle dilepas kembali menjadi in_stock
      const [bundle] = await db
        .select()
        .from(packageItems)
        .where(eq(packageItems.id, bundleId));
      expect(bundle.status).toBe("in_stock");
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(packageItems).where(eq(packageItems.id, bundleId));
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
      await db.delete(students).where(eq(students.id, student.id));
      await db.delete(schools).where(eq(schools.id, school.id));
    }
  });

  it("rejects superseding a picked_up book order", async () => {
    const stamp = `bko_picked_${Date.now()}`;
    const school = await createTestSchool(db, { id: `sch_${stamp}` });
    const student = await createTestStudent(db, { id: `std_${stamp}`, schoolId: school.id });
    const orderId = `ord_${stamp}`;

    try {
      await createTestBookOrder(db, {
        id: orderId,
        orderNumber: `ORD-${stamp}`,
        studentId: student.id,
        schoolId: school.id,
        paymentStatus: "paid",
        fulfillmentStatus: "picked_up",
        totalAmount: 150000,
        paidAmount: 150000,
      });

      expect(isBookOrderPending({ fulfillmentStatus: "picked_up" })).toBe(false);

      const res = await supersedeBookOrder(db, { orderId });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(res.message).toContain("sudah diserahterimakan");
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, student.id));
      await db.delete(schools).where(eq(schools.id, school.id));
    }
  });

  it("supersedes pending uniform order and restocks variant stock via seam", async () => {
    const stamp = `ufo_${Date.now()}`;
    const school = await createTestSchool(db, { id: `sch_${stamp}` });
    const student = await createTestStudent(db, { id: `std_${stamp}`, schoolId: school.id });
    const orderId = `uord_${stamp}`;
    const variantId = `var_${stamp}`;
    const now = new Date().toISOString();

    try {
      await db.insert(uniformVariants).values({
        id: variantId,
        code: `VAR-${stamp}`,
        name: `Baju Olahraga ${stamp}`,
        kind: "olahraga",
        gender: "male",
        jenjang: "sd",
        academicYear: "2026/2027",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(uniformOrders).values({
        id: orderId,
        orderNumber: `USO-${stamp}`,
        studentId: student.id,
        schoolId: school.id,
        academicYear: "2026/2027",
        homeAddressSnapshot: "Jl. Merdeka No 12",
        shipmentStatus: "belum_dikirim",
        paymentStatus: "unpaid",
        totalAmount: 200000,
        paidAmount: 0,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(uniformOrderItems).values({
        id: `uoi_${stamp}`,
        orderId,
        variantId,
        size: "M",
        quantity: 2,
        unitPriceSnapshot: 100000,
        createdAt: now,
      });

      // Initial stock = 5
      await db.insert(uniformStock).values({
        id: `ustk_${stamp}`,
        variantId,
        size: "M",
        quantity: 5,
        updatedAt: now,
      });

      expect(isUniformOrderPending({ shipmentStatus: "belum_dikirim" })).toBe(true);

      const res = await supersedeUniformOrder(db, {
        orderId,
        supersededByOrderId: `uord_new_${stamp}`,
      });

      expect(res.ok).toBe(true);

      const [updatedOrder] = await db
        .select()
        .from(uniformOrders)
        .where(eq(uniformOrders.id, orderId));
      expect(updatedOrder.shipmentStatus).toBe("superseded");
      expect(updatedOrder.supersededByOrderId).toBe(`uord_new_${stamp}`);

      // Stok kembali bertambah dari 5 menjadi 7
      const [stock] = await db
        .select()
        .from(uniformStock)
        .where(eq(uniformStock.variantId, variantId));
      expect(stock.quantity).toBe(7);
    } finally {
      await db.delete(uniformOrderItems).where(eq(uniformOrderItems.orderId, orderId));
      await db.delete(uniformOrders).where(eq(uniformOrders.id, orderId));
      await db.delete(uniformStock).where(eq(uniformStock.variantId, variantId));
      await db.delete(uniformVariants).where(eq(uniformVariants.id, variantId));
      await db.delete(students).where(eq(students.id, student.id));
      await db.delete(schools).where(eq(schools.id, school.id));
    }
  });

  it("rejects superseding a shipped or resi-assigned uniform order", async () => {
    const stamp = `ufo_shipped_${Date.now()}`;
    const school = await createTestSchool(db, { id: `sch_${stamp}` });
    const student = await createTestStudent(db, { id: `std_${stamp}`, schoolId: school.id });
    const orderId = `uord_${stamp}`;
    const now = new Date().toISOString();

    try {
      await db.insert(uniformOrders).values({
        id: orderId,
        orderNumber: `USO-${stamp}`,
        studentId: student.id,
        schoolId: school.id,
        academicYear: "2026/2027",
        homeAddressSnapshot: "Jl. Merdeka No 12",
        shipmentStatus: "belum_dikirim",
        shippingResi: "JNE-12345678",
        paymentStatus: "paid",
        totalAmount: 200000,
        paidAmount: 200000,
        createdAt: now,
        updatedAt: now,
      });

      expect(isUniformOrderPending({ shipmentStatus: "belum_dikirim", shippingResi: "JNE-12345678" })).toBe(false);

      const res = await supersedeUniformOrder(db, { orderId });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(res.message).toContain("sudah dikirim atau memiliki nomor resi");
    } finally {
      await db.delete(uniformOrders).where(eq(uniformOrders.id, orderId));
      await db.delete(students).where(eq(students.id, student.id));
      await db.delete(schools).where(eq(schools.id, school.id));
    }
  });
});
