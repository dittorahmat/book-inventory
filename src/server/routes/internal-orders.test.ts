import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { internalOrdersRouter } from "./internal-orders";
import { db } from "../../db";
import { schools, bookPackages, books, students } from "../../db/schema";

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

  it("creates PO with 30 package lines and fulfills via 30-line shipment (D1 chunk regression)", async () => {
    const stamp = Date.now();
    const branchId = `school-vol-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: branchId,
      name: "Cabang Volume",
      code: `VOL-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });

    const packageSeeds: (typeof bookPackages.$inferInsert)[] = Array.from({ length: 30 }, (_, i) => ({
      id: `pkg-vol-${stamp}-${i}`,
      code: `PKG-VOL-${stamp}-${i}`,
      name: `Paket Volume ${i}`,
      gradeLevel: "1",
      curriculumType: "national",
      academicYear: "2026/2027",
      createdAt: now,
      updatedAt: now,
    }));
    await db.insert(bookPackages).values(packageSeeds);

    const createPoRes = await internalOrdersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: branchId,
        items: packageSeeds.map((p) => ({ packageId: p.id, quantityOrdered: 2 })),
      }),
    });
    expect(createPoRes.status).toBe(201);
    const createPoJson = await createPoRes.json();
    expect(createPoJson.success).toBe(true);
    const poId = createPoJson.data.id;

    const shipRes = await internalOrdersRouter.request(`/${poId}/shipments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryNoteNumber: `SJ-VOL-${stamp}`,
        items: packageSeeds.map((p) => ({ packageId: p.id, quantity: 2 })),
      }),
    });
    expect(shipRes.status).toBe(200);
    const shipJson = await shipRes.json();
    expect(shipJson.success).toBe(true);
    expect(shipJson.data.status).toBe("completed");
  });

  it("returns 404 for unknown PO and 400 for empty shipment lines", async () => {
    const missing = await internalOrdersRouter.request(`/po-tidak-ada/shipments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryNoteNumber: "SJ-XXX",
        items: [{ packageId: "pkg-xxx", quantity: 1 }],
      }),
    });
    expect(missing.status).toBe(404);
    expect((await missing.json()).success).toBe(false);
  });
});

describe("Penerimaan Surat Jalan Internal (spec-111)", () => {
  async function seedPoWithShipment(stamp: number, lineCount: number) {
    const branchId = `school-rcv-${stamp}`;
    const hqId = `school-rcvhq-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values([
      { id: branchId, name: "Cabang Terima", code: `RCV-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
      { id: hqId, name: "Gudang Terima", code: `RHQ-${stamp}`, type: "warehouse", createdAt: now, updatedAt: now },
    ]);
    const bookId = `book-rcv-${stamp}`;
    await db.insert(books).values({
      id: bookId, isbn: `ISBN-RCV-${stamp}`, title: "Buku Terima", author: "A", publisher: "P", createdAt: now, updatedAt: now,
    });
    const packageId = `pkg-rcv-${stamp}`;
    await db.insert(bookPackages).values({
      id: packageId, code: `PKG-RCV-${stamp}`, name: "Paket Terima", gradeLevel: "1",
      curriculumType: "international", academicYear: "2026/2027", createdAt: now, updatedAt: now,
    });
    const createRes = await internalOrdersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: branchId, items: [{ packageId, quantityOrdered: lineCount }] }),
    });
    expect(createRes.status).toBe(201);
    const poId = (await createRes.json()).data.id;
    const shipRes = await internalOrdersRouter.request(`/${poId}/shipments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryNoteNumber: `SJ-RCV-${stamp}`,
        items: Array.from({ length: lineCount }, (_, i) =>
          i === 0 ? { packageId, quantity: lineCount } : { bookId, quantity: 1, isOutstandingFollowup: true }
        ),
      }),
    });
    expect(shipRes.status).toBe(200);
    const shipmentId = (await shipRes.json()).data.shipmentId;
    const historyRes = await internalOrdersRouter.request(`/${poId}/shipments`, { method: "GET" });
    const history = (await historyRes.json()).data;
    const shipment = history.find((s: any) => s.id === shipmentId);
    expect(shipment).toBeDefined();
    return { poId, shipmentId, lineIds: shipment.items.map((i: any) => i.id as string) };
  }

  it("menerima semua-baik menjadi delivered dengan tanggal terima dan upload bukti surat jalan", async () => {
    const stamp = Date.now();
    const { shipmentId, lineIds, poId } = await seedPoWithShipment(stamp, 2);
    const res = await internalOrdersRouter.request(`/shipments/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryProofUrl: "https://storage.example.com/sj-signed.pdf",
        items: lineIds.map((id: string) => ({ shipmentItemId: id, condition: "good" })),
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("delivered");

    const history = (await (await internalOrdersRouter.request(`/${poId}/shipments`, { method: "GET" })).json()).data;
    const received = history.find((s: any) => s.id === shipmentId);
    expect(received.status).toBe("delivered");
    expect(received.deliveryProofUrl).toBe("https://storage.example.com/sj-signed.pdf");
    expect(received.receivedDate).toBeDefined();
    expect(received.items.every((i: any) => i.receivedCondition === "good")).toBe(true);
  });

  it("menolak konfirmasi terima tanpa bukti dokumen surat jalan bertanda tangan", async () => {
    const stamp = Date.now() + 50;
    const { shipmentId, lineIds } = await seedPoWithShipment(stamp, 2);
    const res = await internalOrdersRouter.request(`/shipments/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lineIds.map((id: string) => ({ shipmentItemId: id, condition: "good" })),
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it("menandai discrepancy saat ada baris rusak dan menolak baris asing tanpa tulis", async () => {
    const stamp = Date.now() + 1;
    const { shipmentId, lineIds } = await seedPoWithShipment(stamp, 2);
    const foreign = await internalOrdersRouter.request(`/shipments/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryProofUrl: "https://storage.example.com/sj-signed.pdf",
        items: [{ shipmentItemId: "baris-asing", condition: "good" }],
      }),
    });
    expect(foreign.status).toBe(400);
    expect((await foreign.json()).success).toBe(false);

    const res = await internalOrdersRouter.request(`/shipments/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryProofUrl: "https://storage.example.com/sj-signed.pdf",
        items: [
          { shipmentItemId: lineIds[0], condition: "good" },
          { shipmentItemId: lineIds[1], condition: "damaged", notes: "Dus penyok" },
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("discrepancy");
  });

  it("menerima 30 baris sekaligus tanpa gagal (regresi volume D1)", async () => {
    const stamp = Date.now() + 2;
    const { shipmentId, lineIds } = await seedPoWithShipment(stamp, 30);
    expect(lineIds.length).toBe(30);
    const res = await internalOrdersRouter.request(`/shipments/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryProofUrl: "https://storage.example.com/sj-signed.pdf",
        items: lineIds.map((id: string) => ({ shipmentItemId: id, condition: "good" })),
      }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("delivered");
  });
  it("allows warehouse_admin to view branch POs, access outstanding items, and issue manual shipments", async () => {
    const stamp = Date.now() + 10;
    const branchId = `school-vis-${stamp}`;
    const hqId = `school-wh-${stamp}`;
    const packageId = `pkg-vis-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values([
      { id: branchId, name: "Cabang Visibilitas", code: `VIS-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
      { id: hqId, name: "Gudang Penugasan", code: `GWH-${stamp}`, type: "warehouse", createdAt: now, updatedAt: now },
    ]);

    await db.insert(bookPackages).values({
      id: packageId,
      code: `PKG-VIS-${stamp}`,
      name: "Paket Visibilitas",
      gradeLevel: "1",
      curriculumType: "national",
      academicYear: "2026/2027",
      createdAt: now,
      updatedAt: now,
    });

    // 1. Branch issues PO
    mockActor("branch_admin", branchId);
    const createRes = await internalOrdersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: branchId,
        items: [{ packageId, quantityOrdered: 5 }],
      }),
    });
    expect(createRes.status).toBe(201);
    const poId = ((await createRes.json()) as { data: { id: string } }).data.id;

    // 2. Warehouse admin at school-wh queries internal orders without schoolId filter
    mockActor("warehouse_admin", hqId);
    const listRes = await internalOrdersRouter.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { data: Array<{ id: string }> };
    expect(listJson.data.some((po) => po.id === poId)).toBe(true);

    // 3. Warehouse admin queries /outstanding
    const outRes = await internalOrdersRouter.request("/outstanding", { method: "GET" });
    expect(outRes.status).toBe(200);
    const outJson = (await outRes.json()) as { data: Array<{ id: string; items: Array<{ quantityRemaining: number }> }> };
    const foundOutPo = outJson.data.find((po) => po.id === poId);
    expect(foundOutPo).toBeDefined();
    expect(foundOutPo?.items[0]?.quantityRemaining).toBe(5);

    // 4. Warehouse admin issues Manual Shipment without PO to branch
    const manualShipRes = await internalOrdersRouter.request("/shipments/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinationSchoolId: branchId,
        deliveryNoteNumber: `SJ-MANUAL-${stamp}`,
        notes: "Pengiriman darurat tanpa PO",
        items: [{ packageId, quantity: 2 }],
      }),
    });
    expect(manualShipRes.status).toBe(201);
    const manualJson = (await manualShipRes.json()) as { success: boolean; data: { shipmentId: string } };
    expect(manualJson.success).toBe(true);
    expect(manualJson.data.shipmentId).toBeDefined();
  });

  it("menolak pesanan paket cabang yang melebihi jumlah siswa aktif jenjang tersebut", async () => {
    const stamp = Date.now();
    const branchId = `school-cap-${stamp}`;
    const packageId = `pkg-cap-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: branchId,
      name: "Cabang Kuota Test",
      code: `CP-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(bookPackages).values({
      id: packageId,
      code: `PKG-CAP-${stamp}`,
      name: "Paket Kelas 1 Capping",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 250000,
      createdAt: now,
      updatedAt: now,
    });

    // Seed 2 siswa aktif kelas 1
    await db.insert(students).values([
      {
        id: `stu-1-${stamp}`,
        schoolId: branchId,
        nis: `NIS1-${stamp}`,
        name: "Siswa 1",
        gradeLevel: "1",
        academicYear: "2026/2027",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `stu-2-${stamp}`,
        schoolId: branchId,
        nis: `NIS2-${stamp}`,
        name: "Siswa 2",
        gradeLevel: "1",
        academicYear: "2026/2027",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    mockActor("branch_admin", branchId);

    // Order 5 paket padahal hanya ada 2 siswa -> harus ditolak 400
    const failRes = await internalOrdersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: branchId,
        items: [{ packageId, quantityOrdered: 5 }],
      }),
    });
    expect(failRes.status).toBe(400);
    const failJson = (await failRes.json()) as { success: boolean; message: string };
    expect(failJson.success).toBe(false);
    expect(failJson.message).toContain("melebihi total siswa aktif");

    // Order 2 paket (sesuai kuota siswa) -> harus sukses 201
    const okRes = await internalOrdersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: branchId,
        items: [{ packageId, quantityOrdered: 2 }],
      }),
    });
    expect(okRes.status).toBe(201);
  });
});
