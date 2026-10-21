import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { app } from "../index";
import { db } from "../../db";
import { bookPackages, schools } from "../../db/schema";
import { mockActor, restoreActor } from "./test-actor";

describe("Term Reconciliation Routes", () => {
  beforeEach(() => {
    mockActor("central_admin");
  });

  afterEach(() => {
    restoreActor();
  });

  it("mengompilasi data audit akhir periode untuk cabang", async () => {
    const schoolId = `school-recon-${Date.now()}`;
    await db.insert(schools).values({
      id: schoolId,
      name: "Sekolah Recon Test",
      code: `SRT-${Date.now()}`,
      address: "Jl Test",
      phone: "08123456789",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await app.request(
      `/api/term-reconciliation/compile?schoolId=${schoolId}&academicYear=2026/2027&term=Ganjil`
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { packages: unknown[] } };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.packages)).toBe(true);
  });

  it("menyimpan dan memfinalisasi berita acara rekonsiliasi akhir periode", async () => {
    const schoolId = `school-recon-flow-${Date.now()}`;
    await db.insert(schools).values({
      id: schoolId,
      name: "Sekolah Recon Flow Test",
      code: `SRF-${Date.now()}`,
      address: "Jl Test",
      phone: "08123456789",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const pkgId = `pkg-recon-${Date.now()}`;
    await db.insert(bookPackages).values({
      id: pkgId,
      name: "Paket Recon Test",
      code: `PRT-${Date.now()}`,
      price: 200000,
      gradeLevel: "2",
      academicYear: "2026/2027",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 1. Simpan dokumen rekonsiliasi
    // Skenario user: Kirim 100, Serahkan 97, Sisa sistem 3, Fisik aktual 2 -> Selisih hilang 1
    const saveRes = await app.request("/api/term-reconciliation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        academicYear: "2026/2027",
        term: "Ganjil",
        items: [
          {
            itemType: "package",
            packageId: pkgId,
            totalInbound: 100,
            totalDistributed: 97,
            physicalRemaining: 2,
            unitPrice: 200000,
          },
        ],
      }),
    });

    expect(saveRes.status).toBe(201);
    const saveJson = (await saveRes.json()) as { success: boolean; data: { id: string; reconciliationNumber: string } };
    expect(saveJson.success).toBe(true);
    const reconId = saveJson.data.id;

    // 2. Ambil detail rekonsiliasi
    const detailRes = await app.request(`/api/term-reconciliation/${reconId}`);
    expect(detailRes.status).toBe(200);
    const detailJson = (await detailRes.json()) as {
      success: boolean;
      data: { totalDiscrepancy: number; totalLossAmount: number; totalPhysicalRemaining: number };
    };
    expect(detailJson.data.totalDiscrepancy).toBe(1);
    expect(detailJson.data.totalLossAmount).toBe(200000);
    expect(detailJson.data.totalPhysicalRemaining).toBe(2);

    // 3. Finalisasi rekonsiliasi
    const finalizeRes = await app.request(`/api/term-reconciliation/${reconId}/finalize`, {
      method: "POST",
    });
    expect(finalizeRes.status).toBe(200);

    // 4. Ambil rekap serah terima siswa
    const recapRes = await app.request(`/api/term-reconciliation/recap/${schoolId}`);
    expect(recapRes.status).toBe(200);
  });
});
