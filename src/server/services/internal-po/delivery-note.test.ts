import { describe, expect, it } from "bun:test";
import { db } from "../../../db";
import { internalShipments, schools } from "../../../db/schema";
import { generateDeliveryNoteNumber } from "./delivery-note";
import { eq, like } from "drizzle-orm";

describe("generateDeliveryNoteNumber", () => {
  it("generates SJ-YYYY-MM-DD-001 when no shipments exist on that date", async () => {
    const testDate = "2029-01-01";
    await db.delete(internalShipments).where(like(internalShipments.deliveryNoteNumber, `SJ-${testDate}-%`));

    const num = await generateDeliveryNoteNumber(db, testDate);
    expect(num).toBe(`SJ-${testDate}-001`);
  });

  it("increments sequential number for existing shipments on the same date", async () => {
    const testDate = "2029-01-02";
    const stamp = Date.now();
    const schoolId = `sch-sj-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "SJ Test School",
      code: `SJT-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });

    try {
      await db.insert(internalShipments).values([
        {
          id: `ship-sj-1-${stamp}`,
          destinationSchoolId: schoolId,
          deliveryNoteNumber: `SJ-${testDate}-001`,
          shippedDate: testDate,
          status: "in_transit",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `ship-sj-2-${stamp}`,
          destinationSchoolId: schoolId,
          deliveryNoteNumber: `SJ-${testDate}-002`,
          shippedDate: testDate,
          status: "in_transit",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const nextNum = await generateDeliveryNoteNumber(db, testDate);
      expect(nextNum).toBe(`SJ-${testDate}-003`);
    } finally {
      await db.delete(internalShipments).where(like(internalShipments.deliveryNoteNumber, `SJ-${testDate}-%`));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("generates fallback format when database is omitted", async () => {
    const testDate = "2029-01-03";
    const num = await generateDeliveryNoteNumber(undefined, testDate);
    expect(num).toMatch(new RegExp(`^SJ-${testDate}-\\d{3}$`));
  });
});
