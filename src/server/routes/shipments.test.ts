import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { auth } from "../auth";

const realGetSession = auth.api.getSession;
function actAs(role: "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin" | null, schoolId: string | null = null) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-test", role, schoolId } } as any) : null;
}
beforeEach(() => actAs("central_admin", null));
afterEach(() => {
  (auth.api as any).getSession = realGetSession;
});
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

  it("creates via quantity lines FIFO with effective-price snapshot and receives with discrepancy (T2)", async () => {
    const hqId = crypto.randomUUID();
    const branchId = crypto.randomUUID();
    const bookId = crypto.randomUUID();
    const old1 = crypto.randomUUID();
    const old2 = crypto.randomUUID();
    const new3 = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(schools).values([
      { id: hqId, name: "HQ FIFO", code: "HQ-FIFO", type: "main", createdAt: now, updatedAt: now },
      { id: branchId, name: "Branch FIFO", code: "BR-FIFO", type: "branch", createdAt: now, updatedAt: now },
    ]);
    await db.insert(books).values({
      id: bookId, isbn: "978-0000000144", title: "FIFO Priced Book", author: "QA", publisher: "QA Press",
      price: 50000, sellPrice: 80000, createdAt: now, updatedAt: now,
    });
    await db.insert(bookItems).values([
      { id: old1, bookId, currentSchoolId: hqId, barcode: "FIFO-001", condition: "new", status: "in_stock", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: now },
      { id: old2, bookId, currentSchoolId: hqId, barcode: "FIFO-002", condition: "new", status: "in_stock", createdAt: "2026-01-02T00:00:00.000Z", updatedAt: now },
      { id: new3, bookId, currentSchoolId: hqId, barcode: "FIFO-003", condition: "new", status: "in_stock", createdAt: "2026-01-03T00:00:00.000Z", updatedAt: now },
    ]);

    // Quantity lines: 2 oldest allocated, snapshot = effective sell price (80000, bukan price 50000)
    const draftRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: hqId,
        toSchoolId: branchId,
        items: [{ itemType: "loose", bookId, quantity: 2 }],
      }),
    });
    const draftJson = await draftRes.json();
    expect(draftRes.status).toBe(201);
    expect(draftJson.data.totalDeclaredValue).toBe(160000);
    const shipmentId = draftJson.data.id;

    const detailRes = await shipmentsRouter.request(`/${shipmentId}`);
    const detailJson = await detailRes.json();
    const barcodes = detailJson.data.items.map((i: any) => i.barcode).sort();
    expect(barcodes).toEqual(["FIFO-001", "FIFO-002"]);
    expect(detailJson.data.items[0].unitPriceSnapshot).toBe(80000);

    await shipmentsRouter.request(`/${shipmentId}/dispatch`, { method: "POST" });
    const receiveRes = await shipmentsRouter.request(`/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemReceipts: [
          { bookItemId: old1, condition: "good" },
          { bookItemId: old2, condition: "missing" },
        ],
      }),
    });
    const receiveJson = await receiveRes.json();
    expect(receiveJson.data.status).toBe("completed_with_discrepancy");
    const [lost] = await db.select().from(bookItems).where(eq(bookItems.id, old2));
    expect(lost.status).toBe("lost");
    const [moved] = await db.select().from(bookItems).where(eq(bookItems.id, old1));
    expect(moved.currentSchoolId).toBe(branchId);

    // Cleanup
    await db.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
    await db.delete(transferShipments).where(eq(transferShipments.id, shipmentId));
    await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, hqId));
    await db.delete(schools).where(eq(schools.id, branchId));
  });

  it("rejects empty drafts and unknown packages", async () => {
    const fromId = crypto.randomUUID();
    const toId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schools).values([
      { id: fromId, name: "Reject From", code: `REJ-F-${Date.now()}`, type: "branch", createdAt: now, updatedAt: now },
      { id: toId, name: "Reject To", code: `REJ-T-${Date.now()}`, type: "branch", createdAt: now, updatedAt: now },
    ]);

    const emptyRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSchoolId: fromId, toSchoolId: toId }),
    });
    expect(emptyRes.status).toBe(400);

    const badPkgRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: fromId,
        toSchoolId: toId,
        packageItemIds: ["pkg-item-does-not-exist"],
      }),
    });
    expect(badPkgRes.status).toBe(400);

    const unknownDestRes = await shipmentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: fromId,
        toSchoolId: "school-ghost-does-not-exist",
        packageItemIds: ["pkg-item-does-not-exist"],
      }),
    });
    expect(unknownDestRes.status).toBe(404);

    await db.delete(schools).where(eq(schools.id, fromId));
    await db.delete(schools).where(eq(schools.id, toId));
  });

  it("creates quantity-based draft via FIFO allocation with header total (§10 D1 regression)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const fromId = `school-qty-from-${stamp}`;
    const toId = `school-qty-to-${stamp}`;
    const bookId = `b-qty-${stamp}`;
    const copyIds = Array.from({ length: 30 }, (_, i) => `copy-qty-${stamp}-${i + 1}`);

    try {
      await db.insert(schools).values([
        { id: fromId, name: "Qty From", code: `QTY-F-${stamp}`, type: "warehouse", createdAt: now, updatedAt: now },
        { id: toId, name: "Qty To", code: `QTY-T-${stamp}`, type: "main", createdAt: now, updatedAt: now },
      ]);
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-QTY-${stamp}`, title: "Buku FIFO Test", author: "QA", publisher: "QA",
        price: 100000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values(
        copyIds.map((id, i) => ({
          id, bookId, currentSchoolId: fromId, barcode: `QTY-${stamp}-${i}`,
          condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
        }))
      );

      const res = await shipmentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: fromId,
          toSchoolId: toId,
          items: [{ itemType: "loose", bookId, quantity: 30 }],
          reason: "pindah stock",
          notes: "stock pindah",
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.totalDeclaredValue).toBe(3000000);
      const shipmentId = json.data.id;

      const lines = await db.select().from(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
      expect(lines.length).toBe(30);
      expect(new Set(lines.map((l: any) => l.bookItemId)).size).toBe(30);

      await db.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
      await db.delete(transferShipments).where(eq(transferShipments.id, shipmentId));
    } finally {
      await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, fromId));
      await db.delete(schools).where(eq(schools.id, toId));
    }
  });

  it("rejects quantity draft exceeding available stock with 400 (not 500)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const fromId = `school-short-from-${stamp}`;
    const toId = `school-short-to-${stamp}`;
    const bookId = `b-short-${stamp}`;

    try {
      await db.insert(schools).values([
        { id: fromId, name: "Short From", code: `SHORT-F-${stamp}`, type: "warehouse", createdAt: now, updatedAt: now },
        { id: toId, name: "Short To", code: `SHORT-T-${stamp}`, type: "main", createdAt: now, updatedAt: now },
      ]);
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-SHORT-${stamp}`, title: "Buku Short Test", author: "QA", publisher: "QA",
        price: 50000, createdAt: now, updatedAt: now,
      });

      const res = await shipmentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: fromId,
          toSchoolId: toId,
          items: [{ itemType: "loose", bookId, quantity: 7 }],
        }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).message).toMatch(/Stok tidak cukup/);
    } finally {
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, fromId));
      await db.delete(schools).where(eq(schools.id, toId));
    }
  });

  it("instant transfer memindahkan stok langsung dan DELETE /:id menghapus shipment", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const fromId = `sch-inst-from-${stamp}`;
    const toId = `sch-inst-to-${stamp}`;
    const bookId = `b-inst-${stamp}`;
    const copyId = `bi-inst-${stamp}`;

    try {
      await db.insert(schools).values([
        { id: fromId, name: "Inst From", code: `IN-F-${stamp}`, type: "warehouse", createdAt: now, updatedAt: now },
        { id: toId, name: "Inst To", code: `IN-T-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
      ]);
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-INST-${stamp}`, title: "Buku Instant", author: "QA", publisher: "QA",
        sellPrice: 50000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values({
        id: copyId, bookId, currentSchoolId: fromId, barcode: `BC-INST-${stamp}`, status: "in_stock", condition: "new",
        createdAt: now, updatedAt: now,
      });

      // 1. Buat Instant Transfer
      const res = await shipmentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: fromId,
          toSchoolId: toId,
          bookItemIds: [copyId],
          instant: true,
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.status).toBe("completed");

      // Verifikasi stok langsung pindah ke toId
      const [moved] = await db.select().from(bookItems).where(eq(bookItems.id, copyId));
      expect(moved.currentSchoolId).toBe(toId);
      expect(moved.status).toBe("in_stock");

      // 2. Test DELETE completed shipment -> should be rejected with 400
      const delCompletedRes = await shipmentsRouter.request(`/${json.data.id}`, { method: "DELETE" });
      const delCompletedJson = await delCompletedRes.json();
      expect(delCompletedRes.status).toBe(400);
      expect(delCompletedJson.success).toBe(false);
      expect(delCompletedJson.message).toContain("Completed");

      // 3. Test DELETE draft shipment -> should succeed
      const copyId2 = `c-inst-2-${stamp}`;
      await db.insert(bookItems).values({
        id: copyId2, bookId, currentSchoolId: fromId, barcode: `BC-INST-2-${stamp}`, status: "in_stock", condition: "new",
        createdAt: now, updatedAt: now,
      });

      const draftRes = await shipmentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: fromId,
          toSchoolId: toId,
          bookItemIds: [copyId2],
        }),
      });
      const draftJson = await draftRes.json();
      expect(draftRes.status).toBe(201);

      const delDraftRes = await shipmentsRouter.request(`/${draftJson.data.id}`, { method: "DELETE" });
      expect(delDraftRes.status).toBe(200);
      const [check] = await db.select().from(transferShipments).where(eq(transferShipments.id, draftJson.data.id));
      expect(check).toBeUndefined();

      // Clean up completed shipment row manually
      await db.delete(transferShipments).where(eq(transferShipments.id, json.data.id));
      await db.delete(bookItems).where(eq(bookItems.id, copyId2));
    } finally {
      await db.delete(bookItems).where(eq(bookItems.id, copyId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, fromId));
      await db.delete(schools).where(eq(schools.id, toId));
    }
  });

  it("dispatches + receives 30 lines via batched write seam (§10 D1 regression, T1)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const fromId = `school-t1-from-${stamp}`;
    const toId = `school-t1-to-${stamp}`;
    const bookId = `b-t1-${stamp}`;

    try {
      await db.insert(schools).values([
        { id: fromId, name: "T1 From", code: `T1-F-${stamp}`, type: "warehouse", createdAt: now, updatedAt: now },
        { id: toId, name: "T1 To", code: `T1-T-${stamp}`, type: "main", createdAt: now, updatedAt: now },
      ]);
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-T1-${stamp}`, title: "Buku T1 Volume", author: "QA", publisher: "QA",
        price: 10000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values(
        Array.from({ length: 30 }, (_, i) => ({
          id: `bi-t1-${stamp}-${i}`, bookId, currentSchoolId: fromId, barcode: `T1-${stamp}-${i}`,
          condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
        }))
      );

      const createRes = await shipmentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: fromId, toSchoolId: toId,
          items: [{ itemType: "loose", bookId, quantity: 30 }],
        }),
      });
      expect(createRes.status).toBe(201);
      const shipmentId = (await createRes.json()).data.id;

      const dispatchRes = await shipmentsRouter.request(`/${shipmentId}/dispatch`, { method: "POST" });
      expect(dispatchRes.status).toBe(200);
      expect((await dispatchRes.json()).data.status).toBe("in_transit");
      const inTransit = await db.select().from(bookItems).where(eq(bookItems.bookId, bookId));
      expect(inTransit.filter((r: any) => r.status === "in_transit").length).toBe(30);

      const lines = await db.select().from(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
      expect(lines.length).toBe(30);
      const receiveRes = await shipmentsRouter.request(`/${shipmentId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemReceipts: lines.map((l: any) => ({ bookItemId: l.bookItemId, condition: "good" })),
        }),
      });
      expect(receiveRes.status).toBe(200);
      expect((await receiveRes.json()).data.status).toBe("completed");
      const landed = await db.select().from(bookItems).where(eq(bookItems.bookId, bookId));
      expect(landed.filter((r: any) => r.currentSchoolId === toId && r.status === "in_stock").length).toBe(30);

      await db.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
      await db.delete(transferShipments).where(eq(transferShipments.id, shipmentId));
    } finally {
      await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, fromId));
      await db.delete(schools).where(eq(schools.id, toId));
    }
  });

  it("rolls back 30 in_transit lines to in_stock via module rollback + rejects unknown receipts 400 (T1)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const fromId = `school-t1rb-from-${stamp}`;
    const toId = `school-t1rb-to-${stamp}`;
    const bookId = `b-t1rb-${stamp}`;

    try {
      await db.insert(schools).values([
        { id: fromId, name: "T1RB From", code: `T1RB-F-${stamp}`, type: "warehouse", createdAt: now, updatedAt: now },
        { id: toId, name: "T1RB To", code: `T1RB-T-${stamp}`, type: "main", createdAt: now, updatedAt: now },
      ]);
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-T1RB-${stamp}`, title: "Buku T1 Rollback", author: "QA", publisher: "QA",
        price: 10000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values(
        Array.from({ length: 30 }, (_, i) => ({
          id: `bi-t1rb-${stamp}-${i}`, bookId, currentSchoolId: fromId, barcode: `T1RB-${stamp}-${i}`,
          condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
        }))
      );

      const createRes = await shipmentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: fromId, toSchoolId: toId,
          items: [{ itemType: "loose", bookId, quantity: 30 }],
        }),
      });
      expect(createRes.status).toBe(201);
      const shipmentId = (await createRes.json()).data.id;

      await shipmentsRouter.request(`/${shipmentId}/dispatch`, { method: "POST" });

      // Unknown receipt must 400 (pre-write validation), not silent 200 / 500.
      const badRes = await shipmentsRouter.request(`/${shipmentId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemReceipts: [{ bookItemId: `ghost-${stamp}`, condition: "good" }] }),
      });
      expect(badRes.status).toBe(400);

      // Rollback via DELETE restores all 30 to in_stock at origin.
      const delRes = await shipmentsRouter.request(`/${shipmentId}`, { method: "DELETE" });
      expect(delRes.status).toBe(200);
      const restored = await db.select().from(bookItems).where(eq(bookItems.bookId, bookId));
      expect(restored.filter((r: any) => r.status === "in_stock" && r.currentSchoolId === fromId).length).toBe(30);
      const gone = await db.select().from(transferShipments).where(eq(transferShipments.id, shipmentId));
      expect(gone.length).toBe(0);
    } finally {
      await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, fromId));
      await db.delete(schools).where(eq(schools.id, toId));
    }
  });

  it("branch refund: creates shipment from own school (201), refused from another school (403) (#45)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const ownId = `school-45-own-${stamp}`;
    const otherId = `school-45-other-${stamp}`;
    const warehouseId = `school-45-gudang-${stamp}`;
    const bookId = `b-45-${stamp}`;
    const copyId = `bi-45-${stamp}`;

    try {
      await db.insert(schools).values([
        { id: ownId, name: "Cabang Own 45", code: `OWN45-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
        { id: otherId, name: "Cabang Other 45", code: `OTH45-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
        { id: warehouseId, name: "Gudang 45", code: `GDG45-${stamp}`, type: "warehouse", createdAt: now, updatedAt: now },
      ]);
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-45-${stamp}`, title: "Buku Refund 45", author: "QA", publisher: "QA",
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookItems).values({
        id: copyId, bookId, currentSchoolId: ownId, barcode: `RF45-${stamp}`,
        condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
      });

      // Refund: cabang membuat transfer keluar dari sekolahnya sendiri ke gudang.
      actAs("branch_admin", ownId);
      const ownRes = await shipmentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: ownId,
          toSchoolId: warehouseId,
          bookItemIds: [copyId],
          reason: "refund",
          notes: "Buku rusak dikembalikan ke gudang",
        }),
      });
      expect(ownRes.status).toBe(201);
      const ownJson = await ownRes.json();
      expect(ownJson.success).toBe(true);
      const shipmentId = ownJson.data.id;

      // Dari sekolah lain: ditolak 403.
      const crossRes = await shipmentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: otherId,
          toSchoolId: warehouseId,
          bookItemIds: [copyId],
          reason: "refund",
        }),
      });
      expect(crossRes.status).toBe(403);

      await db.delete(transferShipmentItems).where(eq(transferShipmentItems.shipmentId, shipmentId));
      await db.delete(transferShipments).where(eq(transferShipments.id, shipmentId));
    } finally {
      actAs("central_admin", null);
      await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, ownId));
      await db.delete(schools).where(eq(schools.id, otherId));
      await db.delete(schools).where(eq(schools.id, warehouseId));
    }
  });
});

