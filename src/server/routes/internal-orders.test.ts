import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { internalOrdersRouter } from "./internal-orders";
import { db } from "../../db";
import { schools, bookPackages, books } from "../../db/schema";

describe("Internal Orders & Multi-Delivery Shipments API", () => {
  it("creates internal PO from branch to HQ and records multiple partial shipments without duplicating PO", async () => {
    const stamp = Date.now();
    const branchId = `school-branch-${stamp}`;
    const hqId = `school-hq-${stamp}`;
    const bookId = `book-int-${stamp}`;
    const packageId = `pkg-int-${stamp}`;
    const now = new Date().toISOString();

    // 1. Seed Branch and HQ Warehouse
    await db.insert(schools).values([
      {
        id: branchId,
        name: "Cabang Test",
        code: `CBG-${stamp}`,
        type: "branch",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: hqId,
        name: "Gudang Pusat HQ",
        code: `HQ-${stamp}`,
        type: "warehouse",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 2. Seed Book & Package
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-INT-${stamp}`,
      title: "Buku Kurikulum Internal",
      author: "Penulis Test",
      publisher: "Penerbit Test",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(bookPackages).values({
      id: packageId,
      code: `PKG-INT-${stamp}`,
      name: "Paket Kelas 1 Int",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      createdAt: now,
      updatedAt: now,
    });

    // 3. Cabang menerbitkan PO Internal ke Pusat (10 Paket)
    const createPoRes = await internalOrdersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: branchId,
        notes: "Permintaan awal tahun ajaran",
        items: [{ packageId, quantityOrdered: 10 }],
      }),
    });
    expect(createPoRes.status).toBe(201);
    const createPoJson = await createPoRes.json();
    expect(createPoJson.success).toBe(true);
    const poId = createPoJson.data.id;
    expect(poId).toBeDefined();

    // 4. Pengiriman Surat Jalan Tahap 1 (Kirim 7 paket, ada 3 paket outstanding)
    const ship1Res = await internalOrdersRouter.request(`/${poId}/shipments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryNoteNumber: `SJ-INT-001-${stamp}`,
        notes: "Pengiriman tahap 1 (7 dari 10 paket)",
        items: [{ packageId, quantity: 7, isOutstandingFollowup: false }],
      }),
    });
    expect(ship1Res.status).toBe(200);
    const ship1Json = await ship1Res.json();
    expect(ship1Json.data.status).toBe("partial_fulfilled");

    // 5. Pengiriman Surat Jalan Tahap 2 (Kirim sisa 3 paket backorder dengan Surat Jalan baru)
    const ship2Res = await internalOrdersRouter.request(`/${poId}/shipments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryNoteNumber: `SJ-INT-002-${stamp}`,
        notes: "Pengiriman tahap 2 pelunasan sisa 3 paket",
        items: [{ packageId, quantity: 3, isOutstandingFollowup: true }],
      }),
    });
    expect(ship2Res.status).toBe(200);
    const ship2Json = await ship2Res.json();
    expect(ship2Json.data.status).toBe("completed");

    // 6. Verifikasi histori Surat Jalan PO Internal (ada 2 pengiriman di bawah 1 PO yang sama)
    const historyRes = await internalOrdersRouter.request(`/${poId}/shipments`, {
      method: "GET",
    });
    expect(historyRes.status).toBe(200);
    const historyJson = await historyRes.json();
    expect(historyJson.data.length).toBe(2);
    expect(historyJson.data.some((s: any) => s.deliveryNoteNumber === `SJ-INT-001-${stamp}`)).toBe(true);
    expect(historyJson.data.some((s: any) => s.deliveryNoteNumber === `SJ-INT-002-${stamp}`)).toBe(true);
  });
});
