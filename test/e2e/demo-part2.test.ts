import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../../src/server/index";
import { mockActor, restoreActor } from "../../src/server/routes/test-actor";

describe("E2E Demo Scenario: Part 2 - Skenario 6 s.d. 9 (Verifikasi Staf, Invoice, Handover & Refund)", () => {
  beforeAll(async () => {
    mockActor("central_admin", null);
    const seedRes = await app.request("/api/demo/seed", { method: "POST" });
    expect(seedRes.status).toBe(200);
    restoreActor();
  });

  it("Skenario 6: Verifikasi bukti transfer staf, kasir, dan diskresi finance", async () => {
    mockActor("school_admin", "school-alw-1");

    // 1. Verifikasi struk pending Nathaniel (ORD-202609-002)
    const nathanRes = await app.request("/api/student-orders?search=ORD-202609-002");
    expect(nathanRes.status).toBe(200);
    const nathanOrder = (await nathanRes.json()).data[0];
    expect(nathanOrder.paidAmount).toBe(500000);

    // Ambil daftar pembayaran Nathaniel
    const paymentsRes = await app.request(`/api/payments/orders/${nathanOrder.id}`);
    expect(paymentsRes.status).toBe(200);
    const paymentsData = (await paymentsRes.json()).data;
    const pendingReceipt = paymentsData.payments.find((p: { status: string }) => p.status === "pending");
    expect(pendingReceipt).toBeDefined();

    // Verifikasi pembayaran pending
    const verifyRes = await app.request(`/api/payments/orders/${nathanOrder.id}/payments/${pendingReceipt.id}/verify`, {
      method: "POST",
    });
    expect(verifyRes.status).toBe(200);

    // Cek status order sekarang: lunas (paid)
    const nathanUpdatedRes = await app.request(`/api/student-orders?search=ORD-202609-002`);
    const nathanUpdated = (await nathanUpdatedRes.json()).data[0];
    expect(nathanUpdated.paymentStatus).toBe("paid");
    expect(nathanUpdated.paidAmount).toBe(990000);

    // 2. Demo kasir: Catat pembayaran tunai pada Hendra (ORD-202609-004)
    const hendraRes = await app.request("/api/student-orders?search=ORD-202609-004");
    const hendraOrder = (await hendraRes.json()).data[0];
    expect(hendraOrder.paymentStatus).toBe("unpaid");

    const cashierRes = await app.request(`/api/payments/orders/${hendraOrder.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferAmount: 1350000,
        bookAllocationAmount: 1350000,
        bankName: "KASIR-TUNAI",
        referenceNumber: "CASH-E2E-HENDRA",
        notes: "Pembayaran lunas kasir sekolah",
      }),
    });
    expect(cashierRes.status).toBe(200);

    const hendraUpdatedRes = await app.request(`/api/student-orders?search=ORD-202609-004`);
    expect((await hendraUpdatedRes.json()).data[0].paymentStatus).toBe("paid");

    restoreActor();
  });

  it("Skenario 7: Invoice WhatsApp, ongkir kirim-rumah, dan penolakan duplikasi", async () => {
    // Sesuai aturan: Order satuan hanya diproses oleh gudang pusat (warehouse_admin / central_admin)
    mockActor("central_admin", null);

    // Order satuan Salsabila (ORD-202610-102)
    const salsaRes = await app.request("/api/student-orders?search=ORD-202610-102");
    const salsaOrder = (await salsaRes.json()).data[0];
    expect(salsaOrder.shippingCost).toBe(25000);
    expect(salsaOrder.shippingResi).toBe("JNE-BKU-0002");

    // Update ongkir via endpoint staf
    const updateShipRes = await app.request(`/api/student-orders/${salsaOrder.id}/shipping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shippingCost: 30000,
        shippingResi: "JNE-BKU-0002-EDIT",
      }),
    });
    expect(updateShipRes.status).toBe(200);

    // Kirim invoice WhatsApp
    const sendInvoiceRes = await app.request(`/api/student-orders/${salsaOrder.id}/send-invoice`, {
      method: "POST",
    });
    expect(sendInvoiceRes.status).toBe(200);

    restoreActor();

    // Coba buka dengan token salah -> harus 404
    const notFoundRes = await app.request("/api/public/orders/confirm/token-palsu-ngawur");
    expect(notFoundRes.status).toBe(404);
  });

  it("Skenario 8: Serah terima buku dengan Bukti Pengambilan & penerbitan SJ-SERAH", async () => {
    mockActor("school_admin", "school-alw-1");

    // Cari Kayla (ORD-202610-101), lunas, waiting_preparation
    const kaylaRes = await app.request("/api/student-orders?search=ORD-202610-101");
    expect(kaylaRes.status).toBe(200);
    const kaylaOrder = (await kaylaRes.json()).data[0];
    expect(kaylaOrder.paymentStatus).toBe("paid");
    expect(kaylaOrder.fulfillmentStatus).toBe("waiting_preparation");

    // Serahkan buku (Handover) dengan Bukti Pengambilan
    const handoverRes = await app.request(`/api/student-orders/${kaylaOrder.id}/handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientName: "Hj. Ramadhani (Ibu)",
        notes: "Pengambilan langsung dengan Bukti Pengambilan",
      }),
    });
    expect(handoverRes.status).toBe(200);
    const handoverJson = await handoverRes.json();
    expect(handoverJson.success).toBe(true);
    expect(handoverJson.data.fulfillmentStatus).toBe("picked_up");
    expect(handoverJson.data.deliveryNumber).toMatch(/^SJ-SERAH-/);

    // Pembanding: Aisyah (ORD-202609-001) sudah picked_up dengan SJ-SERAH-202609-0012
    const aisyahRes = await app.request("/api/student-orders?search=ORD-202609-001");
    const aisyahOrder = (await aisyahRes.json()).data[0];
    expect(aisyahOrder.fulfillmentStatus).toBe("picked_up");
    expect(aisyahOrder.handoverDeliveryNumber).toBe("SJ-SERAH-202609-0012");

    restoreActor();
  });

  it("Skenario 9: Refund & Komplain Buku (Lapor, Ganti Buku, atau Tolak)", async () => {
    // 1. Publik lapor komplain buku rusak via portal publik POST /api/public/orders/submit-return
    // Pada demo, Aisyah (ORD-202609-001) sudah diambil, lapor buku Science (b-sci-1)
    const dummyPhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const reportRes = await app.request("/api/public/orders/submit-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "ord-aisyah-done",
        studentId: "std-aisyah-2",
        defectiveBookId: "b-sci-1",
        reason: "Halaman 10-15 sobek dari penerbit",
        photoProofBase64: dummyPhoto,
      }),
    });
    expect(reportRes.status).toBe(201);
    const reportJson = await reportRes.json();
    expect(reportJson.success).toBe(true);
    const returnId = reportJson.data.returnId;

    // Lapor buku yang sama dua kali -> harus 400 (sudah dilaporkan)
    const dupReportRes = await app.request("/api/public/orders/submit-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "ord-aisyah-done",
        studentId: "std-aisyah-2",
        defectiveBookId: "b-sci-1",
        reason: "Lapor ulang buku yang sama",
        photoProofBase64: dummyPhoto,
      }),
    });
    expect(dupReportRes.status).toBe(400);

    // 2. Staf memeriksa dan memutuskan komplain di dashboard
    mockActor("central_admin", null);

    // Putuskan laporan retur baru -> tolak komplain
    const resolveRes = await app.request(`/api/student-orders/returns/${returnId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reject",
      }),
    });
    expect(resolveRes.status).toBe(200);

    restoreActor();
  });
});
