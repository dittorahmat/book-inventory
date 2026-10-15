import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  bookPackages,
  internalPurchaseOrderItems,
  internalPurchaseOrders,
  internalShipmentItems,
  internalShipments,
  schools,
} from "../../../db/schema";
import { createInternalPo, fulfillInternalPo, listInternalPOs, listInternalShipments } from "./po";

describe("Internal PO read seam (T2: list + history behind the module)", () => {
  it("lists POs with grouped lines and filters by school in SQL", async () => {
    const stamp = Date.now();
    const schoolA = `school-t2-a-${stamp}`;
    const schoolB = `school-t2-b-${stamp}`;
    const pkg1 = `pkg-t2-1-${stamp}`;
    const pkg2 = `pkg-t2-2-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values([
      { id: schoolA, name: `T2 A ${stamp}`, code: `T2-A-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
      { id: schoolB, name: `T2 B ${stamp}`, code: `T2-B-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
    ]);
    await db.insert(bookPackages).values([
      { id: pkg1, code: `PKG-T2-1-${stamp}`, name: "Paket T2 Satu", gradeLevel: "1", curriculumType: "national", academicYear: "2026/2027", createdAt: now, updatedAt: now },
      { id: pkg2, code: `PKG-T2-2-${stamp}`, name: "Paket T2 Dua", gradeLevel: "1", curriculumType: "national", academicYear: "2026/2027", createdAt: now, updatedAt: now },
    ]);
    try {
      const poA = await createInternalPo(db, {
        schoolId: schoolA,
        items: [
          { packageId: pkg1, quantityOrdered: 2 },
          { packageId: pkg2, quantityOrdered: 3 },
        ],
      });
      expect(poA.ok).toBe(true);
      const poB = await createInternalPo(db, { schoolId: schoolB, items: [{ packageId: pkg1, quantityOrdered: 1 }] });
      expect(poB.ok).toBe(true);

      const onlyA = await listInternalPOs(db, schoolA);
      expect(onlyA).toHaveLength(1);
      expect(onlyA[0].schoolName).toContain("T2 A");
      expect(onlyA[0].items).toHaveLength(2);
      expect(onlyA[0].items.map((i) => i.packageCode).sort()).toEqual([`PKG-T2-1-${stamp}`, `PKG-T2-2-${stamp}`]);

      const all = await listInternalPOs(db);
      expect(all.some((r) => r.schoolId === schoolA && r.items.length === 2)).toBe(true);
      expect(all.some((r) => r.schoolId === schoolB && r.items.length === 1)).toBe(true);
    } finally {
      await db.delete(internalPurchaseOrderItems).where(eq(internalPurchaseOrderItems.packageId, pkg1));
      await db.delete(internalPurchaseOrderItems).where(eq(internalPurchaseOrderItems.packageId, pkg2));
      const pos = await db.select({ id: internalPurchaseOrders.id }).from(internalPurchaseOrders).where(eq(internalPurchaseOrders.schoolId, schoolA));
      const posB = await db.select({ id: internalPurchaseOrders.id }).from(internalPurchaseOrders).where(eq(internalPurchaseOrders.schoolId, schoolB));
      for (const po of [...pos, ...posB]) {
        await db.delete(internalPurchaseOrders).where(eq(internalPurchaseOrders.id, po.id));
      }
      await db.delete(bookPackages).where(eq(bookPackages.id, pkg1));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkg2));
      await db.delete(schools).where(eq(schools.id, schoolA));
      await db.delete(schools).where(eq(schools.id, schoolB));
    }
  });

  it("lists shipment history with grouped lines and 404s unknown POs", async () => {
    const stamp = Date.now();
    const schoolId = `school-t2-s-${stamp}`;
    const pkgId = `pkg-t2-s-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: `T2 S ${stamp}`, code: `T2-S-${stamp}`, type: "branch", createdAt: now, updatedAt: now,
    });
    await db.insert(bookPackages).values({
      id: pkgId, code: `PKG-T2-S-${stamp}`, name: "Paket T2 Ship", gradeLevel: "2", curriculumType: "national",
      academicYear: "2026/2027", createdAt: now, updatedAt: now,
    });
    try {
      const created = await createInternalPo(db, { schoolId, items: [{ packageId: pkgId, quantityOrdered: 4 }] });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const shipped = await fulfillInternalPo(db, created.data.id, {
        deliveryNoteNumber: `SJ-T2-${stamp}`,
        items: [{ packageId: pkgId, quantity: 2 }],
      });
      expect(shipped.ok).toBe(true);

      const history = await listInternalShipments(db, created.data.id);
      expect(history.ok).toBe(true);
      if (!history.ok) return;
      expect(history.data).toHaveLength(1);
      expect(history.data[0].deliveryNoteNumber).toBe(`SJ-T2-${stamp}`);
      expect(history.data[0].items).toHaveLength(1);
      expect(history.data[0].items[0].packageName).toBe("Paket T2 Ship");

      const ghost = await listInternalShipments(db, `ipo-ghost-${stamp}`);
      expect(ghost.ok).toBe(false);
      if (ghost.ok) return;
      expect(ghost.status).toBe(404);
    } finally {
      const ships = await db.select({ id: internalShipments.id }).from(internalShipments).where(eq(internalShipments.deliveryNoteNumber, `SJ-T2-${stamp}`));
      for (const s of ships) {
        await db.delete(internalShipmentItems).where(eq(internalShipmentItems.shipmentId, s.id));
        await db.delete(internalShipments).where(eq(internalShipments.id, s.id));
      }
      const pos = await db.select({ id: internalPurchaseOrders.id }).from(internalPurchaseOrders).where(eq(internalPurchaseOrders.schoolId, schoolId));
      for (const po of pos) {
        await db.delete(internalPurchaseOrderItems).where(eq(internalPurchaseOrderItems.internalPoId, po.id));
        await db.delete(internalPurchaseOrders).where(eq(internalPurchaseOrders.id, po.id));
      }
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
