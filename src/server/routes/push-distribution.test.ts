import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { app } from "../index";
import { db } from "../../db";
import { bookPackages, schools, students } from "../../db/schema";
import { mockActor, restoreActor } from "./test-actor";

describe("Push Distribution Routes", () => {
  beforeEach(() => {
    mockActor("central_admin");
  });

  afterEach(() => {
    restoreActor();
  });

  it("menghitung kuota Cap Max siswa per cabang", async () => {
    const schoolId = `school-push-${Date.now()}`;
    await db.insert(schools).values({
      id: schoolId,
      name: "Sekolah Push Quota Test",
      code: `SPQ-${Date.now()}`,
      address: "Jl Test",
      phone: "08123456789",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(students).values([
      {
        id: `stu-push-1-${Date.now()}`,
        schoolId,
        nis: `NIS-P1-${Date.now()}`,
        name: "Siswa Push 1",
        gradeLevel: "1",
        academicYear: "2026/2027",
        curriculumType: "national",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `stu-push-2-${Date.now()}`,
        schoolId,
        nis: `NIS-P2-${Date.now()}`,
        name: "Siswa Push 2",
        gradeLevel: "1",
        academicYear: "2026/2027",
        curriculumType: "national",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const res = await app.request(`/api/push-distribution/quota/${schoolId}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { totalActiveStudents: number; grades: unknown[] } };
    expect(json.success).toBe(true);
    expect(json.data.totalActiveStudents).toBeGreaterThanOrEqual(2);
  });

  it("menerbitkan Surat Jalan push distribution langsung ke cabang", async () => {
    const schoolId = `school-push-send-${Date.now()}`;
    await db.insert(schools).values({
      id: schoolId,
      name: "Sekolah Push Send Test",
      code: `SPS-${Date.now()}`,
      address: "Jl Test",
      phone: "08123456789",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const pkgId = `pkg-push-${Date.now()}`;
    await db.insert(bookPackages).values({
      id: pkgId,
      name: "Paket Kelas 1 Push Test",
      code: `PK1P-${Date.now()}`,
      price: 150000,
      gradeLevel: "1",
      academicYear: "2026/2027",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await app.request("/api/push-distribution", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        items: [{ packageId: pkgId, quantity: 15 }],
        notes: "Alokasi awal tahun ajaran",
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { success: boolean; data: { shipmentId: string } };
    expect(json.success).toBe(true);
    expect(json.data.shipmentId).toBeDefined();
  });
});
