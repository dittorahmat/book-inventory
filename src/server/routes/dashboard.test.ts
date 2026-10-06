import { describe, expect, it } from "bun:test";
import { dashboardRouter } from "./dashboard";
import { db } from "../../db";
import {
  bookPackages,
  packageItems,
  schools,
  studentBookOrders,
  students,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  DashboardHttpError,
  resolveScope,
} from "../services/dashboard-summary";

const SCH = "TEST-DSH-SCH";
const UUID_SCH = crypto.randomUUID();
const now = new Date().toISOString();

async function seed() {
  await db.insert(schools).values({ id: SCH, name: "Test Dashboard School", code: "TEST-DSH", type: "branch", createdAt: now, updatedAt: now });
  await db.insert(schools).values({ id: UUID_SCH, name: "Test UUID School", code: "TEST-DSH-UUID", type: "branch", createdAt: now, updatedAt: now });
  await db.insert(bookPackages).values({
    id: "TEST-DSH-PKG", code: "TEST-DSH-PKG", name: "Paket Uji", gradeLevel: "1",
    curriculumType: "international", academicYear: "2026/2027", createdAt: now, updatedAt: now,
  });
  for (let i = 1; i <= 2; i++) {
    await db.insert(packageItems).values({
      id: `TEST-DSH-PI-${i}`, packageId: "TEST-DSH-PKG", currentSchoolId: SCH,
      barcode: `TEST-DSH-BC-${i}`, status: "in_stock", createdAt: now, updatedAt: now,
    });
  }
  for (let i = 1; i <= 2; i++) {
    await db.insert(students).values({
      id: `TEST-DSH-ST-${i}`, schoolId: SCH, nis: `TEST-DSH-NIS-${i}`, name: `Siswa Uji ${i}`,
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      createdAt: now, updatedAt: now,
    });
  }
  const orders = [
    { id: "TEST-DSH-O-1", student: "TEST-DSH-ST-1", payment: "unpaid", fulfill: "waiting_preparation", total: 100000, paid: 0 },
    { id: "TEST-DSH-O-2", student: "TEST-DSH-ST-2", payment: "partial", fulfill: "waiting_preparation", total: 100000, paid: 40000 },
    { id: "TEST-DSH-O-3", student: "TEST-DSH-ST-1", payment: "paid", fulfill: "ready_for_pickup", total: 100000, paid: 100000 },
    { id: "TEST-DSH-O-4", student: "TEST-DSH-ST-2", payment: "unpaid", fulfill: "waiting_preparation", total: 50000, paid: 0 },
  ] as const;
  for (const o of orders) {
    await db.insert(studentBookOrders).values({
      id: o.id, orderNumber: o.id, studentId: o.student, schoolId: SCH,
      paymentStatus: o.payment, fulfillmentStatus: o.fulfill,
      totalAmount: o.total, paidAmount: o.paid, createdAt: now, updatedAt: now,
    });
  }
}

async function cleanup() {
  for (const id of ["TEST-DSH-O-1", "TEST-DSH-O-2", "TEST-DSH-O-3", "TEST-DSH-O-4"]) {
    await db.delete(studentBookOrders).where(eq(studentBookOrders.id, id));
  }
  for (const id of ["TEST-DSH-PI-1", "TEST-DSH-PI-2"]) {
    await db.delete(packageItems).where(eq(packageItems.id, id));
  }
  for (const id of ["TEST-DSH-ST-1", "TEST-DSH-ST-2"]) {
    await db.delete(students).where(eq(students.id, id));
  }
  await db.delete(bookPackages).where(eq(bookPackages.id, "TEST-DSH-PKG"));
  await db.delete(schools).where(eq(schools.id, SCH));
  await db.delete(schools).where(eq(schools.id, UUID_SCH));
}

describe("Dashboard summary API", () => {
  it("computes detail metrics for a seeded string school id", async () => {
    try {
      await cleanup();
      await seed();
      const res = await dashboardRouter.request(`/summary?schoolId=${SCH}`, { method: "GET" });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.mode).toBe("detail");
      const [s] = json.data.schools;
      expect(s.coverage.readyPackages).toBe(2);
      expect(s.coverage.waitingOrders).toBe(3);
      expect(s.coverage.shortfall).toBe(1);
      expect(s.coverage.ratio).toBeCloseTo(2 / 3);
      expect(s.funnel).toMatchObject({ waiting: 3, ready: 1, picked: 0 });
      expect(s.payments.outstandingRp).toBe(210000);
      expect(s.payments.unpaidCount).toBe(3);
      expect(s.payments.paidShare).toBeCloseTo(0.25);
      expect(s.payments.totalOrders).toBe(4);
      expect(s.payments.paidCount).toBe(1);
      expect(s.payments.partialCount).toBe(1);
      expect(s.payments.unpaidOnlyCount).toBe(2);
      const tier = s.breakdown.find((b: { gradeLevel: string }) => b.gradeLevel === "1");
      expect(tier.waitingOrders).toBe(3);
      expect(tier.readyStock).toBe(2);
      expect(tier.shortfall).toBe(1);
    } finally {
      await cleanup();
    }
  });

  it("accepts UUID school ids and reports empty states cleanly", async () => {
    try {
      await cleanup();
      await seed();
      const res = await dashboardRouter.request(`/summary?schoolId=${UUID_SCH}`, { method: "GET" });
      const json = await res.json();
      expect(res.status).toBe(200);
      const [s] = json.data.schools;
      expect(s.coverage.ratio).toBeNull();
      expect(s.coverage.waitingOrders).toBe(0);
      expect(s.payments.paidShare).toBe(1);
    } finally {
      await cleanup();
    }
  });

  it("rejects unknown schools and empty identifiers", async () => {
    const res404 = await dashboardRouter.request("/summary?schoolId=NOPE-NOT-REAL", { method: "GET" });
    expect(res404.status).toBe(404);
    expect((await res404.json()).success).toBe(false);
    const res400 = await dashboardRouter.request("/summary?schoolId=", { method: "GET" });
    expect(res400.status).toBe(400);
  });

  it("returns comparison mode without schoolId", async () => {
    try {
      await cleanup();
      await seed();
      const res = await dashboardRouter.request("/summary", { method: "GET" });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.mode).toBe("comparison");
      expect(json.data.schools.some((s: { school: { id: string } }) => s.school.id === SCH)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("comparison entry matches detail numbers for the same school (single-fetch regression)", async () => {
    try {
      await cleanup();
      await seed();
      const detailRes = await dashboardRouter.request(`/summary?schoolId=${SCH}`, { method: "GET" });
      const detail = (await detailRes.json()).data.schools[0];
      const cmpRes = await dashboardRouter.request("/summary", { method: "GET" });
      const cmp = (await cmpRes.json()).data.schools.find(
        (s: { school: { id: string } }) => s.school.id === SCH
      );
      expect(cmp).toBeDefined();
      expect(cmp.coverage).toMatchObject(detail.coverage);
      expect(cmp.funnel).toMatchObject(detail.funnel);
      expect(cmp.payments.outstandingRp).toBe(detail.payments.outstandingRp);
      expect(cmp.stock.looseInStock).toBe(detail.stock.looseInStock);
    } finally {
      await cleanup();
    }
  });
});

describe("Dashboard scope resolution (branch isolation)", () => {
  const all = ["school-alw-1", "school-alw-2"];
  it("forces branch admin to their own school", () => {
    expect(resolveScope({ role: "branch_admin", schoolId: "school-alw-2" }, undefined, all)).toEqual(["school-alw-2"]);
    expect(() => resolveScope({ role: "branch_admin", schoolId: "school-alw-2" }, "school-alw-1", all)).toThrow(DashboardHttpError);
    expect(() => resolveScope({ role: "branch_admin", schoolId: null }, undefined, all)).toThrow(DashboardHttpError);
  });
  it("lets central admin scope freely but rejects unknown ids", () => {
    expect(resolveScope({ role: "central_admin", schoolId: null }, undefined, all)).toEqual(all);
    expect(resolveScope(null, "school-alw-1", all)).toEqual(["school-alw-1"]);
    expect(() => resolveScope(null, "unknown", all)).toThrow(DashboardHttpError);
  });
});
