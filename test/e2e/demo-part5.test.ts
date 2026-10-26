import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../../src/server/index";
import { mockActor, restoreActor } from "../../src/server/routes/test-actor";

describe("E2E Demo Scenario: Part 5 - Skenario 18 s.d. 20 (Laporan, Dashboard, Pengaturan & Isolasi Peran)", () => {
  beforeAll(async () => {
    mockActor("central_admin", null);
    const seedRes = await app.request("/api/demo/seed", { method: "POST" });
    expect(seedRes.status).toBe(200);
    restoreActor();
  });

  it("Skenario 18: Laporan penjualan, unduh CSV dan ringkasan Dashboard", async () => {
    mockActor("central_admin", null);

    // 1. Dashboard summary
    const dashRes = await app.request("/api/dashboard/summary");
    expect(dashRes.status).toBe(200);
    const dashJson = await dashRes.json();
    expect(dashJson.success).toBe(true);
    expect(dashJson.data.schools.length).toBeGreaterThan(0);
    expect(dashJson.data.schools[0].coverage).toBeDefined();

    // 2. Sales Report JSON
    const reportRes = await app.request("/api/sales-report?from=2026-07-01&to=2026-11-30");
    expect(reportRes.status).toBe(200);
    const reportJson = await reportRes.json();
    expect(reportJson.success).toBe(true);
    expect(reportJson.data.totals.revenue).toBeGreaterThan(0);
    expect(reportJson.data.bySchool.length).toBeGreaterThan(0);

    // 3. Sales Report CSV
    const csvRes = await app.request("/api/sales-report/csv?from=2026-07-01&to=2026-11-30");
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("Content-Type")).toContain("text/csv");
    const csvText = await csvRes.text();
    expect(csvText).toContain("Order Paket");
    expect(csvText).toContain("Omzet");

    restoreActor();
  });

  it("Skenario 19: Pengaturan sistem (Master Cabang, Cut-off Satuan & Seragam)", async () => {
    mockActor("central_admin", null);

    // 1. Cek pengaturan status cut-off satuan via /api/settings/satuan-cutoff
    const cutoffRes = await app.request("/api/settings/satuan-cutoff?academicYear=2026/2027");
    expect(cutoffRes.status).toBe(200);
    const cutoffJson = await cutoffRes.json();
    expect(cutoffJson.data.open).toBe(true);

    // 2. Override status cut-off ke closed via /api/settings/satuan-cutoff/override
    const overrideRes = await app.request("/api/settings/satuan-cutoff/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYear: "2026/2027",
        override: "closed",
      }),
    });
    expect(overrideRes.status).toBe(200);

    // Kembalikan ke open
    await app.request("/api/settings/satuan-cutoff/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYear: "2026/2027",
        override: "open",
      }),
    });

    // 3. Status seragam satuan aktif via /api/settings/uniform-satuan
    const uniformSatuanRes = await app.request("/api/settings/uniform-satuan");
    expect(uniformSatuanRes.status).toBe(200);
    const uniformSatuanJson = await uniformSatuanRes.json();
    expect(uniformSatuanJson.data.open).toBe(true);

    restoreActor();
  });

  it("Skenario 20: Isolasi peran (Central Admin vs Branch Admin)", async () => {
    // 1. Branch Admin 2 hanya dapat melihat data sekolahnya
    mockActor("branch_admin", "school-alw-2");

    // Pesanan di Al Wildan 2
    const ordersAlw2Res = await app.request("/api/student-orders?schoolId=school-alw-2");
    expect(ordersAlw2Res.status).toBe(200);
    const ordersAlw2 = (await ordersAlw2Res.json()).data;
    expect(ordersAlw2.every((o: { schoolId: string }) => o.schoolId === "school-alw-2")).toBe(true);

    // Coba intip pesanan Al Wildan 1 -> harus 403 Forbidden
    const forbiddenRes = await app.request("/api/student-orders?schoolId=school-alw-1");
    expect(forbiddenRes.status).toBe(403);

    // Coba akses tab pengaturan -> harus 403 Forbidden
    const settingsForbidden = await app.request("/api/settings/satuan-cutoff/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYear: "2026/2027",
        override: "closed",
      }),
    });
    expect(settingsForbidden.status).toBe(403);

    // 2. Central Admin bebas melihat semua kampus
    mockActor("central_admin", null);
    const centralOrdersRes = await app.request("/api/student-orders?schoolId=school-alw-1");
    expect(centralOrdersRes.status).toBe(200);

    restoreActor();
  });
});
