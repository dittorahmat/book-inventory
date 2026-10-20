import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";
import { bookReturnsRouter } from "./book-returns";
import { db } from "../../db";
import { schools, books, students, studentBookOrders, bookReturns } from "../../db/schema";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});

describe("Book Returns & Refund API", () => {
  it("allows querying returns list and exporting CSV report", async () => {
    const stamp = Date.now();
    const schoolId = `school-ret-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Cabang Retur Test",
      code: `CRT-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });

    const studentId = `stu-ret-${stamp}`;
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `NIS-R-${stamp}`,
      name: "Siswa Retur",
      gradeLevel: "1",
      academicYear: "2026/2027",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const bookId = `book-ret-${stamp}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `978-602-${stamp.toString().slice(-6)}`,
      title: "Buku Rusak Test",
      author: "Penulis Test",
      publisher: "Penerbit Test",
      createdAt: now,
      updatedAt: now,
    });

    const orderId = `ord-ret-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-R-${stamp}`,
      studentId,
      schoolId,
      createdAt: now,
      updatedAt: now,
    });

    const returnId = `ret-${stamp}`;
    await db.insert(bookReturns).values({
      id: returnId,
      orderId,
      studentId,
      defectiveBookId: bookId,
      reason: "Halaman robek",
      status: "approved",
      refundAmount: 50000,
      createdAt: now,
      updatedAt: now,
    });

    // Test GET /
    const listRes = await bookReturnsRouter.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { success: boolean; data: Array<{ id: string }> };
    expect(listJson.success).toBe(true);
    expect(listJson.data.some((r) => r.id === returnId)).toBe(true);

    // Test GET /export
    const expRes = await bookReturnsRouter.request(`/export?schoolId=${schoolId}&status=approved`, { method: "GET" });
    expect(expRes.status).toBe(200);
    expect(expRes.headers.get("content-type")).toContain("text/csv");
    const csv = await expRes.text();
    expect(csv).toContain("No Order,Sekolah,Nama Siswa");
    expect(csv).toContain("ORD-R-");
    expect(csv).toContain("50000");
  });
});
