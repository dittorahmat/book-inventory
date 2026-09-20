import { describe, expect, it } from "bun:test";
import { shipmentsRouter } from "./shipments";
import { db } from "../../db";
import { schools, books, bookItems, transferShipments, transferShipmentItems } from "../../db/schema";
import { eq } from "drizzle-orm";

describe("Inter-School Transfer Shipments API", () => {
  it("executes full transfer workflow from draft to dispatch and branch receipt with discrepancy", async () => {
    const hqSchoolId = crypto.randomUUID();
    const branchSchoolId = crypto.randomUUID();
    const bookId = crypto.randomUUID();
    const copy1Id = crypto.randomUUID();
    const copy2Id = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Setup HQ and Branch
    await db.insert(schools).values([
      { id: hqSchoolId, name: "HQ Main School", code: "HQ-01", type: "main", createdAt: now, updatedAt: now },
      { id: branchSchoolId, name: "Branch South", code: "BR-SOUTH", type: "branch", createdAt: now, updatedAt: now },
    ]);

    // 2. Setup Book and 2 copies at HQ
    await db.insert(books).values({
      id: bookId,
      isbn: "978-0131103627",
      title: "The C Programming Language",
      author: "Brian Kernighan, Dennis Ritchie",
      publisher: "Prentice Hall",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(bookItems).values([
      { id: copy1Id, bookId, currentSchoolId: hqSchoolId, barcode: "C-PROG-001", condition: "new", status: "in_stock", createdAt: now, updatedAt: now },
      { id: copy2Id, bookId, currentSchoolId: hqSchoolId, barcode: "C-PROG-002", condition: "new", status: "in_stock", createdAt: now, updatedAt: now },
    ]);

    // 3. Create Draft Shipment from HQ to Branch South
    const draftRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: hqSchoolId,
        toSchoolId: branchSchoolId,
        bookItemIds: [copy1Id, copy2Id],
        notes: "Transfer for Semester 1",
      }),
    });
    const draftJson = await draftRes.json();
    expect(draftRes.status).toBe(201);
    expect(draftJson.data.status).toBe("draft");
    const shipmentId = draftJson.data.id;

    // 4. Dispatch Shipment
    const dispatchRes = await shipmentsRouter.request(`/${shipmentId}/dispatch`, { method: "POST" });
    const dispatchJson = await dispatchRes.json();
    expect(dispatchRes.status).toBe(200);
    expect(dispatchJson.data.status).toBe("in_transit");

    // Verify copies are now in_transit
    const [c1AfterDispatch] = await db.select().from(bookItems).where(eq(bookItems.id, copy1Id));
    expect(c1AfterDispatch.status).toBe("in_transit");

    // 5. Branch Receives Shipment (Copy 1 is Good, Copy 2 is Damaged)
    const receiveRes = await shipmentsRouter.request(`/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemReceipts: [
          { bookItemId: copy1Id, condition: "good" },
          { bookItemId: copy2Id, condition: "damaged", notes: "Water damage during transit" },
        ],
      }),
    });
    const receiveJson = await receiveRes.json();
    expect(receiveRes.status).toBe(200);
    expect(receiveJson.data.status).toBe("completed_with_discrepancy");

    // Verify physical copies are now owned by Branch South with correct status & condition
    const [c1AfterReceive] = await db.select().from(bookItems).where(eq(bookItems.id, copy1Id));
    expect(c1AfterReceive.currentSchoolId).toBe(branchSchoolId);
    expect(c1AfterReceive.status).toBe("in_stock");
    expect(c1AfterReceive.condition).toBe("new");

    const [c2AfterReceive] = await db.select().from(bookItems).where(eq(bookItems.id, copy2Id));
    expect(c2AfterReceive.currentSchoolId).toBe(branchSchoolId);
    expect(c2AfterReceive.status).toBe("in_stock");
    expect(c2AfterReceive.condition).toBe("damaged");

    // Cleanup
    await db.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
    await db.delete(transferShipments).where(eq(transferShipments.id, shipmentId));
    await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, hqSchoolId));
    await db.delete(schools).where(eq(schools.id, branchSchoolId));
  });
});
