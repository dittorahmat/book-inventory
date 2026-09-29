import { describe, expect, it } from "bun:test";
import { shipmentsRouter } from "./shipments";
import { db } from "../../db";
import { schools, books, bookItems, bookPackages, packageItems, transferShipments, transferShipmentItems } from "../../db/schema";
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
        reason: "Distribusi buku baru",
      }),
    });
    const draftJson = await draftRes.json();
    expect(draftRes.status).toBe(201);
    expect(draftJson.data.status).toBe("draft");
    expect(draftJson.data.reason).toBe("Distribusi buku baru");
    const shipmentId = draftJson.data.id;

    // Verify detail endpoint returns reason and item condition
    const detailRes = await shipmentsRouter.request(`/${shipmentId}`);
    const detailJson = await detailRes.json();
    expect(detailRes.status).toBe(200);
    expect(detailJson.data.reason).toBe("Distribusi buku baru");
    expect(detailJson.data.items.length).toBe(2);
    expect(detailJson.data.items[0].condition).toBe("new");

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

  it("creates a mixed loose+package draft with price snapshots and frozen history (custom slug IDs)", async () => {
    const now = new Date().toISOString();
    const hqId = "school-mix-hq";
    const branchId = "school-mix-branch";
    const bookId = crypto.randomUUID();
    const copyId = crypto.randomUUID();
    const packageId = crypto.randomUUID();
    const bundle1Id = crypto.randomUUID();
    const bundle2Id = crypto.randomUUID();

    await db.insert(schools).values([
      { id: hqId, name: "HQ Mix", code: "HQ-MIX", type: "main", createdAt: now, updatedAt: now },
      { id: branchId, name: "Branch Mix", code: "BR-MIX", type: "branch", createdAt: now, updatedAt: now },
    ]);
    await db.insert(books).values({
      id: bookId, isbn: "978-0000000099", title: "Mix Priced Book", author: "QA", publisher: "QA Press",
      price: 100000, createdAt: now, updatedAt: now,
    });
    await db.insert(bookItems).values({
      id: copyId, bookId, currentSchoolId: hqId, barcode: "MIX-001", condition: "new", status: "in_stock",
      createdAt: now, updatedAt: now,
    });
    await db.insert(bookPackages).values({
      id: packageId, code: "PKG-MIX-1", name: "Mix Package", gradeLevel: "1",
      curriculumType: "international", academicYear: "2026/2027", price: 1850000, createdAt: now, updatedAt: now,
    });
    await db.insert(packageItems).values([
      { id: bundle1Id, packageId, currentSchoolId: hqId, barcode: "PKG-MIX-0001", status: "in_stock", createdAt: now, updatedAt: now },
      { id: bundle2Id, packageId, currentSchoolId: hqId, barcode: "PKG-MIX-0002", status: "in_stock", createdAt: now, updatedAt: now },
    ]);

    // Mixed draft: 1 loose @100rb + 2 bundles @1.85jt = 3.8jt
    const draftRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: hqId,
        toSchoolId: branchId,
        bookItemIds: [copyId],
        packageItemIds: [bundle1Id, bundle2Id],
      }),
    });
    const draftJson = await draftRes.json();
    expect(draftRes.status).toBe(201);
    expect(draftJson.data.totalDeclaredValue).toBe(3800000);
    const shipmentId = draftJson.data.id;

    const detailRes = await shipmentsRouter.request(`/${shipmentId}`);
    const detailJson = await detailRes.json();
    expect(detailRes.status).toBe(200);
    expect(detailJson.data.items.length).toBe(3);
    const loose = detailJson.data.items.find((i: any) => i.itemType === "loose");
    const pkgs = detailJson.data.items.filter((i: any) => i.itemType === "package");
    expect(loose.unitPriceSnapshot).toBe(100000);
    expect(loose.lineTotal).toBe(100000);
    expect(pkgs.length).toBe(2);
    expect(pkgs[0].unitPriceSnapshot).toBe(1850000);
    expect(pkgs[0].lineTotal).toBe(1850000);

    // Master price change must not rewrite frozen history
    await db.update(books).set({ price: 250000 }).where(eq(books.id, bookId));
    await db.update(bookPackages).set({ price: 9999999 }).where(eq(bookPackages.id, packageId));
    const frozenRes = await shipmentsRouter.request(`/${shipmentId}`);
    const frozenJson = await frozenRes.json();
    expect(frozenJson.data.totalDeclaredValue).toBe(3800000);
    expect(frozenJson.data.items.find((i: any) => i.itemType === "loose").unitPriceSnapshot).toBe(100000);

    // List exposes nominal + counts
    const listRes = await shipmentsRouter.request(`/?schoolId=${hqId}`);
    const listJson = await listRes.json();
    const listed = listJson.data.find((s: any) => s.id === shipmentId);
    expect(listed.totalDeclaredValue).toBe(3800000);
    expect(listed.looseCount).toBe(1);
    expect(listed.packageCount).toBe(2);

    // Dispatch locks loose (in_transit) and bundles (dispatched)
    await shipmentsRouter.request(`/${shipmentId}/dispatch`, { method: "POST" });
    const [b1Dispatched] = await db.select().from(packageItems).where(eq(packageItems.id, bundle1Id));
    expect(b1Dispatched.status).toBe("dispatched");

    // Receive moves both to destination as in_stock
    const receiveRes = await shipmentsRouter.request(`/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemReceipts: [{ bookItemId: copyId, condition: "good" }],
        packageReceipts: [
          { packageItemId: bundle1Id, condition: "good" },
          { packageItemId: bundle2Id, condition: "good" },
        ],
      }),
    });
    const receiveJson = await receiveRes.json();
    expect(receiveJson.data.status).toBe("completed");
    const [moved] = await db.select().from(bookItems).where(eq(bookItems.id, copyId));
    expect(moved.currentSchoolId).toBe(branchId);
    const [b1Moved] = await db.select().from(packageItems).where(eq(packageItems.id, bundle1Id));
    expect(b1Moved.currentSchoolId).toBe(branchId);
    expect(b1Moved.status).toBe("in_stock");

    // Cleanup
    await db.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
    await db.delete(transferShipments).where(eq(transferShipments.id, shipmentId));
    await db.delete(packageItems).where(eq(packageItems.packageId, packageId));
    await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
    await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, hqId));
    await db.delete(schools).where(eq(schools.id, branchId));
  });

  it("handles package damaged/missing discrepancy and guards non-ready bundles", async () => {
    const now = new Date().toISOString();
    const hqId = "school-pkg-hq";
    const branchId = "school-pkg-branch";
    const packageId = crypto.randomUUID();
    const goodId = crypto.randomUUID();
    const dmgId = crypto.randomUUID();
    const lostId = crypto.randomUUID();
    const reservedId = crypto.randomUUID();

    await db.insert(schools).values([
      { id: hqId, name: "HQ Pkg", code: "HQ-PKG", type: "main", createdAt: now, updatedAt: now },
      { id: branchId, name: "Branch Pkg", code: "BR-PKG", type: "branch", createdAt: now, updatedAt: now },
    ]);
    await db.insert(bookPackages).values({
      id: packageId, code: "PKG-DISC-1", name: "Disc Package", gradeLevel: "1",
      curriculumType: "national", academicYear: "2026/2027", price: 950000, createdAt: now, updatedAt: now,
    });
    await db.insert(packageItems).values([
      { id: goodId, packageId, currentSchoolId: hqId, barcode: "PKG-D-001", status: "in_stock", createdAt: now, updatedAt: now },
      { id: dmgId, packageId, currentSchoolId: hqId, barcode: "PKG-D-002", status: "in_stock", createdAt: now, updatedAt: now },
      { id: lostId, packageId, currentSchoolId: hqId, barcode: "PKG-D-003", status: "in_stock", createdAt: now, updatedAt: now },
      { id: reservedId, packageId, currentSchoolId: hqId, barcode: "PKG-D-004", status: "reserved", createdAt: now, updatedAt: now },
    ]);

    // Reserved bundle must be rejected
    const reservedRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSchoolId: hqId, toSchoolId: branchId, packageItemIds: [reservedId] }),
    });
    expect(reservedRes.status).toBe(400);

    const draftRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSchoolId: hqId, toSchoolId: branchId, packageItemIds: [goodId, dmgId, lostId] }),
    });
    const draftJson = await draftRes.json();
    expect(draftRes.status).toBe(201);
    expect(draftJson.data.totalDeclaredValue).toBe(2850000);
    const shipmentId = draftJson.data.id;

    await shipmentsRouter.request(`/${shipmentId}/dispatch`, { method: "POST" });
    const receiveRes = await shipmentsRouter.request(`/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageReceipts: [
          { packageItemId: goodId, condition: "good" },
          { packageItemId: dmgId, condition: "damaged", notes: "Box sobek" },
          { packageItemId: lostId, condition: "missing" },
        ],
      }),
    });
    const receiveJson = await receiveRes.json();
    expect(receiveJson.data.status).toBe("completed_with_discrepancy");

    const [goodRow] = await db.select().from(packageItems).where(eq(packageItems.id, goodId));
    expect(goodRow.currentSchoolId).toBe(branchId);
    expect(goodRow.status).toBe("in_stock");
    const [dmgRow] = await db.select().from(packageItems).where(eq(packageItems.id, dmgId));
    expect(dmgRow.currentSchoolId).toBe(branchId);
    expect(dmgRow.notes).toContain("transit");
    const lostRows = await db.select().from(packageItems).where(eq(packageItems.id, lostId));
    expect(lostRows.length).toBe(0);

    // Cleanup
    await db.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
    await db.delete(transferShipments).where(eq(transferShipments.id, shipmentId));
    await db.delete(packageItems).where(eq(packageItems.packageId, packageId));
    await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
    await db.delete(schools).where(eq(schools.id, hqId));
    await db.delete(schools).where(eq(schools.id, branchId));
  });

  it("rejects empty drafts and unknown packages", async () => {
    const emptyRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSchoolId: "school-alw-1", toSchoolId: "school-alw-2" }),
    });
    expect(emptyRes.status).toBe(400);

    const badPkgRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: "school-alw-1",
        toSchoolId: "school-alw-2",
        packageItemIds: ["pkg-item-does-not-exist"],
      }),
    });
    expect(badPkgRes.status).toBe(400);
  });
});
