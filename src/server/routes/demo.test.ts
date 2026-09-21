import { describe, expect, it } from "bun:test";
import { demoRouter } from "./demo";
import { db } from "../../db";
import { schools, books, bookItems, transferShipments } from "../../db/schema";
import { eq } from "drizzle-orm";

describe("Demo Seeding API", () => {
  it("seeds 4 Al Wildan schools, Cambridge books, physical barcodes, and sample transfer", async () => {
    const res = await demoRouter.request("/seed", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.schools).toBe(4);
    expect(json.data.books).toBe(5);
    expect(json.data.bookItems).toBeGreaterThan(50);

    // Verify Al Wildan 1 HQ exists
    const [hq] = await db.select().from(schools).where(eq(schools.id, "school-alw-1"));
    expect(hq).toBeDefined();
    expect(hq.type).toBe("main");
    expect(hq.code).toBe("ALW-01-HQ");

    // Verify Al Wildan 2 Branch exists
    const [br2] = await db.select().from(schools).where(eq(schools.id, "school-alw-2"));
    expect(br2).toBeDefined();
    expect(br2.type).toBe("branch");

    // Verify Cambridge book catalog
    const [cambMath] = await db.select().from(books).where(eq(books.isbn, "978-1108437189"));
    expect(cambMath).toBeDefined();
    expect(cambMath.title).toContain("Cambridge IGCSE Mathematics");

    // Verify physical book items exist
    const alwItems = await db.select().from(bookItems).where(eq(bookItems.currentSchoolId, "school-alw-1"));
    expect(alwItems.length).toBeGreaterThan(0);
    expect(alwItems[0].barcode).toStartWith("ALW1-");

    // Verify transfer shipment sample
    const [shipment] = await db.select().from(transferShipments).where(eq(transferShipments.id, "ship-demo-alw-01"));
    expect(shipment).toBeDefined();
    expect(shipment.fromSchoolId).toBe("school-alw-1");
    expect(shipment.toSchoolId).toBe("school-alw-2");
    expect(shipment.status).toBe("in_transit");
  });
});
