import { describe, expect, it } from "bun:test";
import { procurementRouter } from "./procurement";
import { db } from "../../db";
import { schools, books } from "../../db/schema";

describe("Supplier Procurement & Purchase Order API", () => {
  it("registers supplier, creates purchase order, and receives inbound loose books", async () => {
    const schoolId = "test-po-dest-school";
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Logistics Central",
      code: `ALW-LOG-${Date.now()}`,
      type: "main",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const bookId = `b-po-${Date.now()}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-PO-${Date.now()}`,
      title: "English Checkpoint 1",
      author: "Cambridge",
      publisher: "CUP",
      createdAt: now,
      updatedAt: now,
    });

    // 1. Create Supplier
    const supRes = await procurementRouter.request("/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `SUP-ERL-${Date.now()}`,
        name: "Penerbit Erlangga",
        contactPerson: "Bpk. Suryono",
        email: "sales@erlangga.co.id",
        phone: "+62218765432",
      }),
    });
    expect(supRes.status).toBe(201);
    const supJson = await supRes.json();
    const supplierId = supJson.data.id;

    // 2. Create Purchase Order for 50 books
    const poRes = await procurementRouter.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        targetSchoolId: schoolId,
        orderDate: "2026-09-24",
        notes: "Pengadaan awal tahun ajaran baru",
        items: [
          {
            bookId,
            quantityOrdered: 50,
            unitPrice: 85000,
          },
        ],
      }),
    });
    expect(poRes.status).toBe(201);
    const poJson = await poRes.json();
    const poId = poJson.data.id;
    expect(poJson.data.status).toBe("ordered");

    // 3. Query PO to get the purchaseOrderItem id
    const listRes = await procurementRouter.request("/purchase-orders", { method: "GET" });
    const listJson = await listRes.json();
    const createdPO = listJson.data.find((p: any) => p.id === poId);
    expect(createdPO).toBeDefined();
    const poItemId = createdPO.items[0].id;

    // 4. Inbound receiving (Partial 20 units)
    const recRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receivedItems: [
          {
            poItemId,
            quantityToReceive: 20,
          },
        ],
      }),
    });
    expect(recRes.status).toBe(200);
    const recJson = await recRes.json();
    expect(recJson.data.status).toBe("partially_received");
    expect(recJson.data.totalReceivedThisBatch).toBe(20);

    // 5. Inbound receiving remainder (30 units) -> status should become received
    const recFinalRes = await procurementRouter.request(`/purchase-orders/${poId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receivedItems: [
          {
            poItemId,
            quantityToReceive: 30,
          },
        ],
      }),
    });
    expect(recFinalRes.status).toBe(200);
    const recFinalJson = await recFinalRes.json();
    expect(recFinalJson.data.status).toBe("received");
  });
});
