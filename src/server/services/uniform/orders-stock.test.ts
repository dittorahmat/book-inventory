import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { uniformOrders, uniformPackageBom, uniformPackageStock, uniformPackages, uniformStock, uniformVariants } from "../../../db/schema";
import { dropSeed, seedSchool, seedStudent } from "../../lib/test-seed";
import { submitUniformOrder } from "./orders";

const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

describe("uniform reserveUniformStock: agregat per kunci", () => {
  it("dua baris varian-size sama mengurangi stok sekali total (2+3 dari 10 → 5)", async () => {
    const now = new Date().toISOString();
    const schoolId = await seedSchool(`ors-${suffix}`, "ORS Test");
    const studentId = await seedStudent(`ors-st-${suffix}`, schoolId, "ORS", `NISORS${suffix}`);
    const variantId = `uv-ors-${suffix}`;
    await db.insert(uniformVariants).values({
      id: variantId, code: `UK-ORS-${suffix}`, name: "Kain ORS", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 50000,
      createdAt: now, updatedAt: now,
    });
    await db.insert(uniformStock).values({ id: `us-ors-${suffix}`, variantId, size: "—", quantity: 10, updatedAt: now });
    await db.insert(uniformOrders).values({
      id: `uord-ors-prior-${suffix}`, orderNumber: `USO-PRIOR-${suffix}`, studentId, schoolId,
      academicYear: "2026/2027", homeAddressSnapshot: "Jl. ORS RT 01 RW 01, 12345",
      orderType: "regular", totalAmount: 0, paidAmount: 0, paymentStatus: "paid",
      createdAt: now, updatedAt: now,
    });
    try {
      const res = await submitUniformOrder(db, {
        studentId, academicYear: "2026/2027", homeAddress: "Jl. ORS RT 01 RW 01, 12345",
        items: [
          { variantId, size: "—", quantity: 2 },
          { variantId, size: "—", quantity: 3 },
        ],
      });
      expect(res.ok).toBe(true);
      const [stock] = await db.select().from(uniformStock).where(eq(uniformStock.variantId, variantId));
      expect(stock.quantity).toBe(5);
    } finally {
      const orders = await db.select({ id: uniformOrders.id }).from(uniformOrders).where(eq(uniformOrders.studentId, studentId));
      for (const o of orders) await db.delete(uniformOrders).where(eq(uniformOrders.id, o.id));
      await db.delete(uniformStock).where(eq(uniformStock.variantId, variantId));
      await db.delete(uniformVariants).where(eq(uniformVariants.id, variantId));
      await dropSeed({ schoolIds: [schoolId], studentIds: [studentId] });
    }
  });

  it("dua baris paket sama mengurangi stok rakitan sekali total (1+2 dari 10 → 7)", async () => {
    const now = new Date().toISOString();
    const schoolId = await seedSchool(`orp-${suffix}`, "ORP Test");
    const studentId = await seedStudent(`orp-st-${suffix}`, schoolId, "ORP", `NISORP${suffix}`);
    const variantId = `uv-orp-${suffix}`;
    const packageId = `up-orp-${suffix}`;
    await db.insert(uniformVariants).values({
      id: variantId, code: `UK-ORP-${suffix}`, name: "Kain ORP", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 50000,
      createdAt: now, updatedAt: now,
    });
    await db.insert(uniformPackages).values({
      id: packageId, code: `UPK-ORP-${suffix}`, name: "Paket ORP",
      academicYear: "2026/2027", price: 50000, createdAt: now, updatedAt: now,
    });
    await db.insert(uniformPackageBom).values({
      id: `ub-orp-${suffix}`, packageId, variantId, size: "—", quantity: 1, createdAt: now,
    });
    await db.insert(uniformPackageStock).values({ id: `ups-orp-${suffix}`, packageId, quantity: 10, updatedAt: now });
    try {
      const res = await submitUniformOrder(db, {
        studentId, academicYear: "2026/2027", homeAddress: "Jl. ORP RT 01 RW 01, 12345",
        items: [
          { packageId, quantity: 2 },
          { packageId, quantity: 1 },
        ],
      });
      expect(res.ok).toBe(true);
      const [stock] = await db.select().from(uniformPackageStock).where(eq(uniformPackageStock.packageId, packageId));
      expect(stock.quantity).toBe(7);
    } finally {
      const orders = await db.select({ id: uniformOrders.id }).from(uniformOrders).where(eq(uniformOrders.studentId, studentId));
      for (const o of orders) await db.delete(uniformOrders).where(eq(uniformOrders.id, o.id));
      await db.delete(uniformPackageStock).where(eq(uniformPackageStock.packageId, packageId));
      await db.delete(uniformPackageBom).where(eq(uniformPackageBom.packageId, packageId));
      await db.delete(uniformPackages).where(eq(uniformPackages.id, packageId));
      await db.delete(uniformVariants).where(eq(uniformVariants.id, variantId));
      await dropSeed({ schoolIds: [schoolId], studentIds: [studentId] });
    }
  });
});
