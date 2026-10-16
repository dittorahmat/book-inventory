import { describe, expect, it } from "bun:test";
import { db } from "../../../db";
import { uniformOrders } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { getUniformNumbering, importUniformShipping, isUniformSatuanEnabled, saveUniformNumbering, setUniformSatuanEnabled } from "./index";
import { dropSeed, seedSchool, seedStudent } from "../../lib/test-seed";

const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

describe("uniform numbering + satuan toggle + import-shipping seam", () => {
  it("round-trips numbering/satuan and reports updated vs rejected rows", async () => {
    const now = new Date().toISOString();
    const schoolId = await seedSchool(`c4-${suffix}`, "C4 Test");
    const withOrderId = await seedStudent(`c4a-${suffix}`, schoolId, "C4", `NISC4A${suffix}`);
    const noOrderId = await seedStudent(`c4b-${suffix}`, schoolId, "C4", `NISC4B${suffix}`);
    const orderId = `uord-c4-${suffix}`;
    const before = await getUniformNumbering(db);
    try {
      const saved = await saveUniformNumbering(db, { orderPrefix: "U9", claimPrefix: "C9" });
      expect(saved).toEqual({ orderPrefix: "U9", claimPrefix: "C9" });
      expect(await getUniformNumbering(db)).toEqual(saved);

      expect((await setUniformSatuanEnabled(db, false)).open).toBe(false);
      expect(await isUniformSatuanEnabled(db)).toBe(false);
      expect((await setUniformSatuanEnabled(db, true)).open).toBe(true);

      await db.insert(uniformOrders).values({
        id: orderId, orderNumber: `USO-C4-${suffix}`, studentId: withOrderId, schoolId,
        academicYear: "2026/2027", homeAddressSnapshot: "Jl. C4 No. 1 RT 01 RW 02, 12345",
        orderType: "regular", totalAmount: 100000, paidAmount: 100000, paymentStatus: "paid",
        createdAt: now, updatedAt: now,
      }).onConflictDoNothing();

      const result = await importUniformShipping(db, schoolId, [
        { nis: `NISC4A${suffix}`, resi: "RESI-C4", ongkir: 15000 },
        { nis: "NIS-TIDAK-ADA", resi: "", ongkir: 0 },
        { nis: `NISC4B${suffix}`, resi: "", ongkir: 0 },
      ], true);
      expect(result.updated).toEqual([`NISC4A${suffix}`]);
      expect(result.rejected.map((r) => r.nis).sort()).toEqual(["NIS-TIDAK-ADA", `NISC4B${suffix}`].sort());
      const [updatedOrder] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
      expect(updatedOrder.shippingCost).toBe(15000);
      expect(updatedOrder.shippingResi).toBe("RESI-C4");
      expect(updatedOrder.shipmentStatus).toBe("sudah_dikirim");
    } finally {
      await saveUniformNumbering(db, before);
      await db.delete(uniformOrders).where(eq(uniformOrders.id, orderId));
      await dropSeed({ schoolIds: [schoolId], studentIds: [withOrderId, noOrderId] });
    }
  });
});
