import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../../src/server/index";
import { mockActor, restoreActor } from "../../src/server/routes/test-actor";
import { DUMMY_PROOF_IMAGE, seedDemoDatabase } from "./helpers";

describe("E2E Demo Scenario: Part 1 - Skenario 1 s.d. 5 (Portal Publik & Verifikasi Intake)", () => {
  beforeAll(async () => {
    await seedDemoDatabase();
  });

  it("Skenario 1: Paket terkunci, kenaikan kelas, dan empty state", async () => {
    // 1. Cari Hendra (naik kelas 1 -> 2)
    const hendraRes = await app.request("/api/public/orders/search-students?query=Hendra&schoolId=school-alw-1");
    expect(hendraRes.status).toBe(200);
    const hendraJson = await hendraRes.json();
    expect(hendraJson.success).toBe(true);
    expect(hendraJson.data.length).toBeGreaterThan(0);
    const hendra = hendraJson.data[0];
    expect(hendra.name).toBe("Hendra Wahyudi");
    expect(hendra.nis).toBe("2024101001");
    expect(hendra.currentGradeLevel).toBe("1");
    expect(hendra.targetGradeLevel).toBe("2");
    expect(hendra.detectedStatus).toBe("naik_kelas");
    expect(hendra.canOrder).toBe(true);

    // 2. Cari Bimo (Kelas 1 -> 2, Nasional)
    const bimoRes = await app.request("/api/public/orders/search-students?query=Bimo&schoolId=school-alw-1");
    expect(bimoRes.status).toBe(200);
    const bimo = (await bimoRes.json()).data[0];
    expect(bimo.curriculumType).toBe("national");
    expect(bimo.targetGradeLevel).toBe("2");

    // 3. Cari Raka (Kelas 2 -> 3, kurikulum internasional)
    const rakaRes = await app.request("/api/public/orders/search-students?query=Raka&schoolId=school-alw-1");
    expect(rakaRes.status).toBe(200);
    const raka = (await rakaRes.json()).data[0];
    expect(raka.currentGradeLevel).toBe("2");
    expect(raka.targetGradeLevel).toBe("3");

    // Di portal: daftar paket publik tidak memiliki paket untuk kelas 3
    const pkgsRes = await app.request("/api/public/orders/packages");
    expect(pkgsRes.status).toBe(200);
    const pkgsJson = await pkgsRes.json();
    const hasClass3Pkg = pkgsJson.data.some((p: { gradeLevel: string }) => p.gradeLevel === "3");
    expect(hasClass3Pkg).toBe(false);
  });

  it("Skenario 2: Order satuan + WPR wajib (Bimo belum punya order paket)", async () => {
    // Ambil info murid Bimo
    const bimoRes = await app.request("/api/public/orders/search-students?query=Bimo&schoolId=school-alw-1");
    const bimo = (await bimoRes.json()).data[0];

    // Cek kelayakan WPR
    const wprRes = await app.request(`/api/public/orders/wpr-eligibility?studentId=${bimo.id}`);
    expect(wprRes.status).toBe(200);
    const wprJson = await wprRes.json();
    expect(wprJson.data.needsWpr).toBe(true);
    expect(wprJson.data.wprPrice).toBe(750000);

    // Submit order satuan dengan alamat rumah lengkap dan bukti bayar
    const dummyProof = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const orderRes = await app.request("/api/public/orders/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: bimo.id,
        orderType: "regular",
        looseItems: [
          { bookId: "b-eng-1", quantity: 1 },
          { bookId: "b-math-1", quantity: 1 },
        ],
        homeAddress: "Jl. Melati No. 12 RT 02 RW 05, Tangerang Selatan 15412",
        parentPhoneManual: "081234567890",
        payment: {
          transferAmount: 1000000,
          bookAllocationAmount: 1000000,
          bankName: "BCA",
          referenceNumber: "BCA-BIMO-001",
          paymentProofBase64: dummyProof,
        },
      }),
    });
    expect(orderRes.status).toBe(201);
    const orderJson = await orderRes.json();
    expect(orderJson.success).toBe(true);
    // Buku Rp 130.000 + Rp 120.000 + WPR Rp 750.000 = Rp 1.000.000
    expect(orderJson.data.totalAmount).toBe(1000000);
    expect(orderJson.data.wprCharged).toBe(true);
    // Sesuai ADR-0018 rekonsiliasi mandiri: transfer penuh (Rp 1.000.000) langsung paid (Lunas)
    expect(orderJson.data.paymentStatus).toBe("paid");

    // Verifikasi pembanding Salsabila (ORD-202610-102) sudah ada di demo
    mockActor("school_admin", "school-alw-1");
    const checkOrderRes = await app.request("/api/student-orders?search=ORD-202610-102");
    expect(checkOrderRes.status).toBe(200);
    const checkOrderJson = await checkOrderRes.json();
    expect(checkOrderJson.data[0].totalAmount).toBe(1000000);
    restoreActor();
  });

  it("Skenario 3: Pendaftaran murid baru dan verifikasi NIS", async () => {
    // 1. Daftar murid baru via portal
    const registerRes = await app.request("/api/public/orders/register-student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "school-alw-1",
        name: "Zaidan Faris Test E2E",
        gender: "male",
        gradeLevel: "1",
        curriculumType: "international",
        academicYear: "2026/2027",
        parentName: "Faris Abdullah",
        parentPhone: "081234567890",
        parentEmail: "faris@example.com",
      }),
    });
    expect(registerRes.status).toBe(201);
    const registerJson = await registerRes.json();
    expect(registerJson.success).toBe(true);
    const studentId = registerJson.data.id;
    expect(registerJson.data.status).toBe("new_pending");

    // 2. Sebelum verifikasi, murid tidak bisa dicari di search publik
    const searchBeforeRes = await app.request("/api/public/orders/search-students?query=Zaidan%20Faris%20Test&schoolId=school-alw-1");
    const searchBeforeJson = await searchBeforeRes.json();
    expect(searchBeforeJson.data.length).toBe(0);

    // 3. Staf menyetujui dan memberi NIS resmi via POST /api/students/:id/verify
    mockActor("school_admin", "school-alw-1");
    const approveRes = await app.request(`/api/students/${studentId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", nis: "20269999" }),
    });
    expect(approveRes.status).toBe(200);
    restoreActor();

    // 4. Setelah disetujui, murid aktif dan bisa dicari
    const searchAfterRes = await app.request("/api/public/orders/search-students?query=Zaidan%20Faris%20Test&schoolId=school-alw-1");
    const searchAfterJson = await searchAfterRes.json();
    expect(searchAfterJson.data.length).toBe(1);
    expect(searchAfterJson.data[0].nis).toBe("20269999");
  });

  it("Skenario 4: Beasiswa 100% dan persetujuan staf", async () => {
    // Order demo beasiswa ORD-202609-003 (Farhan)
    mockActor("school_admin", "school-alw-1");
    const getRes = await app.request("/api/student-orders?search=ORD-202609-003");
    expect(getRes.status).toBe(200);
    const farhanOrder = (await getRes.json()).data[0];
    expect(farhanOrder.paymentStatus).toBe("scholarship_pending");
    expect(farhanOrder.totalAmount).toBe(0);

    // Staf menyetujui beasiswa via paymentsRouter
    const approveRes = await app.request(`/api/payments/orders/${farhanOrder.id}/scholarship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", notes: "Disetujui komite beasiswa" }),
    });
    expect(approveRes.status).toBe(200);
    const approveJson = await approveRes.json();
    expect(approveJson.data.paymentStatus).toBe("scholarship_approved");
    restoreActor();
  });

  it("Skenario 5: Bukti transfer portal menjadi struk pending & tolak duplikasi", async () => {
    // 1. Submit bukti transfer dengan token pembayaran
    const submitRes = await app.request("/api/public/orders/confirm/demo-token-buku-satuan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferAmount: 500000,
        allocationAmount: 500000,
        bankName: "BCA",
        referenceNumber: "BCA-E2E-TEST-001",
        paymentProofBase64: DUMMY_PROOF_IMAGE,
      }),
    });
    expect(submitRes.status).toBe(201);
    const submitJson = await submitRes.json();
    expect(submitJson.success).toBe(true);

    // 2. Duplikasi nomor referensi + bank yang sama harus 409
    const dupRes = await app.request("/api/public/orders/confirm/demo-token-buku-satuan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferAmount: 500000,
        allocationAmount: 500000,
        bankName: "BCA",
        referenceNumber: "BCA-E2E-TEST-001",
        paymentProofBase64: DUMMY_PROOF_IMAGE,
      }),
    });
    expect(dupRes.status).toBe(409);
  });
});
