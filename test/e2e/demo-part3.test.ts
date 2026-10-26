import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../../src/server/index";
import { mockActor, restoreActor } from "../../src/server/routes/test-actor";
import { seedDemoDatabase } from "./helpers";

describe("E2E Demo Scenario: Part 3 - Skenario 10 s.d. 13 (Katalog, Rakit/Bongkar, Jual Langsung, PO & Internal Logistics)", () => {
  beforeAll(async () => {
    await seedDemoDatabase();
  });

  it("Skenario 10: Master katalog, perakitan dan pembongkaran bundel paket di Gudang Pusat", async () => {
    // Perakitan paket hanya diizinkan di Gudang Pusat (school-warehouse)
    mockActor("central_admin", null);

    // 1. Cek katalog buku: 12 judul buku + WPR
    const booksRes = await app.request("/api/books");
    expect(booksRes.status).toBe(200);
    const booksJson = await booksRes.json();
    expect(booksJson.data.length).toBeGreaterThanOrEqual(12);

    // 2. Cek paket & stok bundel di Gudang Pusat
    const pkgsRes = await app.request("/api/packages?schoolId=school-warehouse");
    expect(pkgsRes.status).toBe(200);
    const pkgsJson = await pkgsRes.json();
    const pkgSd1 = pkgsJson.data.find((p: { id: string }) => p.id === "pkg-sd1-int");
    expect(pkgSd1).toBeDefined();

    // 3. Rakit 1 paket Kelas 1 Internasional di Gudang Pusat
    const assembleRes = await app.request(`/api/packages/${pkgSd1.id}/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "school-warehouse",
        quantity: 1,
      }),
    });
    expect(assembleRes.status).toBe(200);
    const assembleJson = await assembleRes.json();
    expect(assembleJson.success).toBe(true);

    // 4. Bongkar paket 1 bundel dengan alasan wajib
    const disassembleRes = await app.request(`/api/packages/${pkgSd1.id}/unbundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "school-warehouse",
        quantity: 1,
        reason: "Penggantian buku cacat fisik",
      }),
    });
    expect(disassembleRes.status).toBe(200);

    restoreActor();
  });

  it("Skenario 11: Stok satuan & penjualan langsung tunai di Gudang Pusat", async () => {
    mockActor("central_admin", null);

    // POST penjualan langsung kasir gudang
    const directRes = await app.request("/api/direct-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "school-warehouse",
        buyerName: "Ibu Ratna Dewi Test",
        buyerPhone: "081298765432",
        paymentMethod: "cash",
        notes: "Penjualan langsung tunai di loket gudang pusat",
        items: [
          { bookId: "b-math-1", quantity: 1 },
          { bookId: "b-eng-1", quantity: 1 },
        ],
      }),
    });
    expect(directRes.status).toBe(201);
    const directJson = await directRes.json();
    expect(directJson.success).toBe(true);
    expect(directJson.data.orderNumber).toMatch(/^DIR-/);
    expect(directJson.data.totalAmount).toBe(250000); // 120.000 + 130.000

    restoreActor();
  });

  it("Skenario 12: Pengadaan PO Supplier dan pencatatan Retur Vendor (RTV)", async () => {
    mockActor("central_admin", null);

    // 1. Cek riwayat PO Supplier PO-202609-0088 (diterima sebagian)
    const posRes = await app.request("/api/procurement/purchase-orders");
    expect(posRes.status).toBe(200);
    const posJson = await posRes.json();
    const poDemo = posJson.data.find((p: { poNumber: string }) => p.poNumber === "PO-202609-0088");
    expect(poDemo).toBeDefined();

    // 2. Buat PO Baru draft dengan supplier resmi buku Cambridge (PT Mentari Books Utama)
    const createPoRes = await app.request("/api/procurement/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: "sup-cambridge-mentari",
        targetSchoolId: "school-warehouse",
        orderDate: "2026-10-27",
        expectedArrivalDate: "2026-11-05",
        notes: "PO Pengadaan Tambahan Semester Ganjil E2E",
        items: [
          { bookId: "b-math-1", quantityOrdered: 50, unitPrice: 70000, discountPercent: 0 },
        ],
      }),
    });
    expect(createPoRes.status).toBe(201);

    // 3. Buat dan catat dokumen Retur Vendor (RTV) baru atas buku cacat
    const createRtvRes = await app.request("/api/vendor-returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: "sup-cambridge-mentari",
        reason: "Halaman terbalik dari percetakan pada kiriman baru",
        creditNoteAmount: 140000,
        items: [{ bookId: "b-math-1", quantity: 2, reason: "Cacat fisik halaman terbalik" }],
      }),
    });
    expect(createRtvRes.status).toBe(201);
    const createRtvJson = await createRtvRes.json();
    expect(createRtvJson.success).toBe(true);
    expect(createRtvJson.data.returnNumber).toMatch(/^RTV-/);

    // Verifikasi daftar Retur Vendor mencakup RTV demo lama dan RTV baru
    const rtvRes = await app.request("/api/vendor-returns");
    expect(rtvRes.status).toBe(200);
    const rtvJson = await rtvRes.json();
    const demoRtv = rtvJson.data.find((r: { returnNumber: string }) => r.returnNumber === "RTV-202610-0001");
    expect(demoRtv).toBeDefined();
    expect(demoRtv.creditNoteAmount).toBe(285000);

    restoreActor();
  });

  it("Skenario 13: Pesanan internal cabang (IPO), transfer shipment & surat jalan", async () => {
    // 1. Cabang 2 melihat pesanan internal IPO-202610-0001 (submitted)
    mockActor("branch_admin", "school-alw-2");
    const ipoRes = await app.request("/api/internal-orders?schoolId=school-alw-2");
    expect(ipoRes.status).toBe(200);
    const ipos = (await ipoRes.json()).data;
    const ipo1 = ipos.find((i: { poNumber: string }) => i.poNumber === "IPO-202610-0001");
    expect(ipo1).toBeDefined();
    expect(ipo1.status).toBe("submitted");

    // 2. Alur Transfer Shipment: Gudang membuat draft shipment, dispatch dengan Surat Jalan (SJ-TRF-*), lalu cabang terima (receive)
    mockActor("central_admin", null);

    // a. Buat draft shipment transfer dari gudang ke Cabang 2 (2 buku loose b-math-1)
    const draftRes = await app.request("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: "school-warehouse",
        toSchoolId: "school-alw-2",
        items: [{ itemType: "loose", bookId: "b-math-1", quantity: 2 }],
        notes: "Pengiriman pemenuhan IPO Cabang 2",
        reason: "Pemenuhan IPO Cabang 2",
      }),
    });
    expect(draftRes.status).toBe(201);
    const draftJson = await draftRes.json();
    expect(draftJson.success).toBe(true);
    const shipmentId = draftJson.data.id;
    expect(draftJson.data.shipmentNumber).toMatch(/^TRF-/);

    // b. Gudang dispatch shipment (status -> in_transit)
    const dispatchRes = await app.request(`/api/shipments/${shipmentId}/dispatch`, {
      method: "POST",
    });
    expect(dispatchRes.status).toBe(200);

    // Ambil detail shipment untuk item IDs
    const detailRes = await app.request(`/api/shipments/${shipmentId}`);
    expect(detailRes.status).toBe(200);
    const detailJson = await detailRes.json();
    expect(detailJson.data.status).toBe("in_transit");

    // c. Cabang 2 menerima shipment transfer (receive)
    mockActor("branch_admin", "school-alw-2");
    const receiveRes = await app.request(`/api/shipments/${shipmentId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemReceipts: detailJson.data.items.map((it: { bookItemId: string }) => ({
          bookItemId: it.bookItemId,
          condition: "good",
        })),
      }),
    });
    expect(receiveRes.status).toBe(200);

    // d. Pastikan shipment berstatus completed
    const finalDetailRes = await app.request(`/api/shipments/${shipmentId}`);
    expect(finalDetailRes.status).toBe(200);
    const finalDetailJson = await finalDetailRes.json();
    expect(finalDetailJson.data.status).toBe("completed");

    restoreActor();
  });
});
