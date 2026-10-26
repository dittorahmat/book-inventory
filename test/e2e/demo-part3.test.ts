import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../../src/server/index";
import { mockActor, restoreActor } from "../../src/server/routes/test-actor";

describe("E2E Demo Scenario: Part 3 - Skenario 10 s.d. 13 (Katalog, Rakit/Bongkar, Jual Langsung, PO & Internal Logistics)", () => {
  beforeAll(async () => {
    mockActor("central_admin", null);
    const seedRes = await app.request("/api/demo/seed", { method: "POST" });
    expect(seedRes.status).toBe(200);
    restoreActor();
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

    // 3. Cek Retur Vendor RTV-202610-0001
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

    // 2. Gudang Pusat melihat riwayat transfer shipments
    mockActor("central_admin", null);
    const shipmentsRes = await app.request("/api/shipments");
    expect(shipmentsRes.status).toBe(200);
    const shipmentsJson = await shipmentsRes.json();
    expect(shipmentsJson.data.length).toBeGreaterThan(0);

    restoreActor();
  });
});
