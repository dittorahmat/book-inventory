import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../../src/server/index";
import { mockActor, restoreActor } from "../../src/server/routes/test-actor";

describe("E2E Demo Scenario: Part 4 - Skenario 14 s.d. 17 (Gudang Seragam, Portal Seragam, Rekonsiliasi & BA)", () => {
  beforeAll(async () => {
    mockActor("central_admin", null);
    const seedRes = await app.request("/api/demo/seed", { method: "POST" });
    expect(seedRes.status).toBe(200);
    restoreActor();
  });

  it("Skenario 14: Operasi gudang seragam (pengiriman, katalog, PO & tukar ukuran)", async () => {
    mockActor("warehouse_uniforms_admin", "school-warehouse");

    // 1. Cek pesanan seragam yang ada di demo (USO-DEMO-01 s.d 05)
    const listRes = await app.request("/api/uniforms/orders");
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.data.length).toBeGreaterThanOrEqual(4);

    const uso1 = listJson.data.find((o: { orderNumber: string }) => o.orderNumber === "USO-DEMO-01");
    expect(uso1).toBeDefined();

    // 2. Cek varian & paket seragam
    const variantsRes = await app.request("/api/uniforms/variants");
    expect(variantsRes.status).toBe(200);
    const variantsJson = await variantsRes.json();
    expect(variantsJson.data.length).toBeGreaterThan(0);

    // 3. Cek pengajuan tukar seragam demo (ex-demo-01)
    const exchangesRes = await app.request("/api/uniforms/exchanges");
    expect(exchangesRes.status).toBe(200);
    const exchangesJson = await exchangesRes.json();
    const ex1 = exchangesJson.data.find((e: { id: string }) => e.id === "ex-demo-01");
    expect(ex1).toBeDefined();

    restoreActor();
  });

  it("Skenario 15: Portal publik seragam (aturan paket pertama murid baru & tukar)", async () => {
    // 1. Murid yang belum pernah beli paket seragam (Fauzan di Al Wildan 2)
    // Coba pesan satuan saja -> ditolak server
    const fauzanRes = await app.request("/api/public/uniform-orders/search-students?query=Fauzan&schoolId=school-alw-2");
    expect(fauzanRes.status).toBe(200);
    const fauzan = (await fauzanRes.json()).data[0];
    expect(fauzan).toBeDefined();

    // Varian Olahraga SD Perempuan
    const variantId = "uv-demo-ol-sd-f";

    const orderFauzanRes = await app.request("/api/public/uniform-orders/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: fauzan.id,
        academicYear: "2026/2027",
        homeAddress: "Jl. Dahlia No. 4 RT 01 RW 02, Tangerang 15111",
        items: [
          { variantId, size: "M", quantity: 1 },
        ],
      }),
    });
    expect(orderFauzanRes.status).toBe(400);
    const orderFauzanJson = await orderFauzanRes.json();
    expect(orderFauzanJson.message).toContain("paket");

    // 2. Murid yang sudah pernah beli paket seragam (Kayla di Al Wildan 1 sudah punya USO-DEMO-04)
    const kaylaRes = await app.request("/api/public/uniform-orders/search-students?query=Kayla&schoolId=school-alw-1");
    const kayla = (await kaylaRes.json()).data[0];
    expect(kayla).toBeDefined();

    const orderKaylaRes = await app.request("/api/public/uniform-orders/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: kayla.id,
        academicYear: "2026/2027",
        homeAddress: "Jl. Pinus No. 8 RT 05 RW 01, Tangerang Selatan 15414",
        items: [
          { variantId, size: "M", quantity: 1 },
        ],
      }),
    });
    expect(orderKaylaRes.status).toBe(201);
  });

  it("Skenario 16: Rekonsiliasi finansial & klaim cabang", async () => {
    mockActor("central_admin", null);

    const period = new Date().toISOString().slice(0, 7);

    // Muat rekonsiliasi Al Wildan 1
    const reconRes = await app.request(`/api/reconciliation?schoolId=school-alw-1&period=${period}`);
    expect(reconRes.status).toBe(200);
    const reconJson = await reconRes.json();
    expect(reconJson.success).toBe(true);
    expect(reconJson.data).toBeDefined();

    // Muat klaim cabang Al Wildan 1 via /api/uniforms/claims
    const claimsRes = await app.request(`/api/uniforms/claims?schoolId=school-alw-1`);
    expect(claimsRes.status).toBe(200);
    const claimsJson = await claimsRes.json();
    expect(claimsJson.data.length).toBeGreaterThan(0);
    const claim1 = claimsJson.data[0];
    expect(claim1.schoolId).toBe("school-alw-1");

    restoreActor();
  });

  it("Skenario 17: Audit akhir periode, kompilasi selisih & Berita Acara (BA)", async () => {
    mockActor("central_admin", null);

    // 1. Compile audit data untuk Al Wildan 1 term Ganjil 2026/2027 via GET
    const compileRes = await app.request("/api/term-reconciliation/compile?schoolId=school-alw-1&academicYear=2026/2027&term=Ganjil");
    expect(compileRes.status).toBe(200);
    const compileJson = await compileRes.json();
    expect(compileJson.success).toBe(true);
    expect(compileJson.data.packages.length).toBeGreaterThan(0);

    // 2. Cek dokumen Berita Acara yang sudah di-compile dan difinalisasi di demo (BA-RECON-DEMO-0001)
    const listBaRes = await app.request("/api/term-reconciliation/list?schoolId=school-alw-1");
    expect(listBaRes.status).toBe(200);
    const listBaJson = await listBaRes.json();
    const demoBa = listBaJson.data.find((b: { reconciliationNumber: string }) => b.reconciliationNumber === "BA-RECON-DEMO-0001");
    expect(demoBa).toBeDefined();
    expect(demoBa.status).toBe("finalized");
    expect(demoBa.totalDiscrepancy).toBe(2);
    expect(demoBa.totalLossAmount).toBe(2840000);

    restoreActor();
  });
});
