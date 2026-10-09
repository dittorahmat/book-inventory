import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../index";
import { db } from "../../db";
import { bookReturns, books, schools, studentBookOrders, students } from "../../db/schema";

describe("Search timing middleware (#38)", () => {
  it("emits tookMs meta + structured log on all 5 search endpoints", async () => {
    const stamp = Date.now();
    const schoolId = `school-tm-${stamp}`;
    const now = new Date().toISOString();
    const orderNumber = `ORD-TM-${String(stamp).slice(-6)}`;
    await db.insert(schools).values({ id: schoolId, name: `Sekolah ${schoolId}`, code: `ALW-TM-${stamp}`, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      await db.insert(students).values({
        id: `st-tm-${stamp}`, schoolId, nis: `TMN${stamp}`, name: `Timing Salsa ${stamp}`,
        gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: `b-tm-${stamp}`, isbn: `ISBN-TM-${stamp}`, title: `Buku Timing ${stamp}`,
        author: "Anon", publisher: "Penerbit", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-tm-${stamp}`, orderNumber, studentId: `st-tm-${stamp}`, schoolId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "picked_up",
        totalAmount: 100000, paidAmount: 100000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: `ret-tm-${stamp}`, orderId: `ord-tm-${stamp}`, studentId: `st-tm-${stamp}`, defectiveBookId: `b-tm-${stamp}`,
        reason: "Uji timing", status: "reported", createdAt: now, updatedAt: now,
      });

      const paths = [
        `/api/public/orders/search-students?query=salsa&schoolId=${schoolId}`,
        `/api/public/orders/lookup-order?query=${encodeURIComponent(orderNumber)}&schoolId=${schoolId}`,
        `/api/students?schoolId=${schoolId}&search=salsa`,
        `/api/student-orders?schoolId=${schoolId}&search=salsa`,
        `/api/student-orders/returns?status=reported`,
      ];
      for (const p of paths) {
        const res = await app.request(p);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(typeof json.meta?.tookMs).toBe("number");
        expect(json.meta.tookMs).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(json.data)).toBe(true);
      }

      const timingLogs = logs.filter((l) => l.includes('"src":"search-timing"')).map((l) => JSON.parse(l));
      expect(timingLogs.length).toBe(5);
      for (const entry of timingLogs) {
        expect(typeof entry.ms).toBe("number");
        expect(entry.ms).toBeGreaterThanOrEqual(0);
        expect(typeof entry.rows).toBe("number");
        expect(typeof entry.route).toBe("string");
      }
      const portalEntry = timingLogs.find((e) => e.route === "/api/public/orders/search-students");
      expect(portalEntry.schoolId).toBe(schoolId);

      // Jalur error (400 validasi): tanpa meta, tanpa crash, log tetap jalan.
      const bad = await app.request(`/api/public/orders/search-students?query=x`);
      expect(bad.status).toBe(400);
      expect((await bad.json()).meta).toBeUndefined();
    } finally {
      console.log = origLog;
      await db.delete(bookReturns).where(eq(bookReturns.id, `ret-tm-${stamp}`));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `ord-tm-${stamp}`));
      await db.delete(books).where(eq(books.id, `b-tm-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-tm-${stamp}`));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("leaves non-search routes untouched (no meta, no timing log)", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);
      expect((await res.json()).meta).toBeUndefined();
      expect(logs.some((l) => l.includes('"src":"search-timing"'))).toBe(false);
    } finally {
      console.log = origLog;
    }
  });
});
