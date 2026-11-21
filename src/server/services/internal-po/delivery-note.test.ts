import { afterEach, describe, expect, it } from "bun:test";
import { db } from "../../../db";
import { internalShipments, schools } from "../../../db/schema";
import { generateDeliveryNoteNumber } from "./delivery-note";
import { createTestSchool } from "../../lib/test-fixtures";
import { eq, like } from "drizzle-orm";

describe("generateDeliveryNoteNumber", () => {
  const createdSchoolIds: string[] = [];
  const trackedPrefixes: string[] = [];

  afterEach(async () => {
    for (const prefix of trackedPrefixes) {
      await db.delete(internalShipments).where(like(internalShipments.deliveryNoteNumber, `${prefix}%`));
    }
    trackedPrefixes.length = 0;

    for (const id of createdSchoolIds) {
      await db.delete(schools).where(eq(schools.id, id));
    }
    createdSchoolIds.length = 0;
  });

  it("generates SJ-YYYY-MM-DD-001 when no shipments exist on that date", async () => {
    const testDate = "2029-01-01";
    trackedPrefixes.push(`SJ-${testDate}-`);
    await db.delete(internalShipments).where(like(internalShipments.deliveryNoteNumber, `SJ-${testDate}-%`));

    const num = await generateDeliveryNoteNumber(db, testDate);
    expect(num).toBe(`SJ-${testDate}-001`);
  });

  it("increments sequential number for existing shipments on the same date", async () => {
    const testDate = "2029-01-02";
    trackedPrefixes.push(`SJ-${testDate}-`);
    const school = await createTestSchool(db, { name: "SJ Test School" });
    createdSchoolIds.push(school.id);
    const now = new Date().toISOString();

    await db.insert(internalShipments).values([
      {
        id: `ship-sj-1-${Date.now()}`,
        destinationSchoolId: school.id,
        deliveryNoteNumber: `SJ-${testDate}-001`,
        shippedDate: testDate,
        status: "in_transit",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `ship-sj-2-${Date.now()}`,
        destinationSchoolId: school.id,
        deliveryNoteNumber: `SJ-${testDate}-002`,
        shippedDate: testDate,
        status: "in_transit",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const nextNum = await generateDeliveryNoteNumber(db, testDate);
    expect(nextNum).toBe(`SJ-${testDate}-003`);
  });

  it("handles non-numeric or alphanumeric fallback records without collision", async () => {
    const testDate = "2029-01-04";
    trackedPrefixes.push(`SJ-${testDate}-`);
    const school = await createTestSchool(db, { name: "SJ Test School Fallback" });
    createdSchoolIds.push(school.id);
    const now = new Date().toISOString();

    // Row dengan nomor sekuensial dan row dengan nomor acak/custom
    await db.insert(internalShipments).values([
      {
        id: `ship-sj-fb1-${Date.now()}`,
        destinationSchoolId: school.id,
        deliveryNoteNumber: `SJ-${testDate}-001`,
        shippedDate: testDate,
        status: "in_transit",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `ship-sj-fb2-${Date.now()}`,
        destinationSchoolId: school.id,
        deliveryNoteNumber: `SJ-${testDate}-XYZ999`,
        shippedDate: testDate,
        status: "in_transit",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const nextNum = await generateDeliveryNoteNumber(db, testDate);
    expect(nextNum).toBe(`SJ-${testDate}-002`);
  });

  it("generates fallback format when database is omitted", async () => {
    const testDate = "2029-01-03";
    const num = await generateDeliveryNoteNumber(undefined, testDate);
    expect(num).toMatch(new RegExp(`^SJ-${testDate}-[A-Z0-9]{6}$`));
  });
});
