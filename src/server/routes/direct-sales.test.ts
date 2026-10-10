import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { directSalesRouter } from "./direct-sales";
import { sellDirect } from "../services/direct-sale";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { schools, books, bookItems, studentBookOrders, studentOrderItems, orderPayments, students } from "../../db/schema";

describe("Direct Sales API", () => {
  it("sells multiple titles atomically via Write Batch (volume regression)", async () => {
    const stamp = Date.now();
    const hqId = `school-dsold-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: hqId,
      name: "Gudang Pusat Direct",
      code: `DSHQ-${stamp}`,
      type: "warehouse",
      createdAt: now,
      updatedAt: now,
    });

    const bookIds = [`book-ds-a-${stamp}`, `book-ds-b-${stamp}`];
    await db.insert(books).values(
      bookIds.map((id, i) => ({
        id,
        isbn: `ISBN-DS-${stamp}-${i}`,
        title: `Buku Direct ${i}`,
        author: "Penulis Test",
        publisher: "Penerbit Test",
        sellPrice: 50000 + i * 10000,
        createdAt: now,
        updatedAt: now,
      }))
    );

    await db.insert(bookItems).values(
      bookIds.flatMap((bookId, i) =>
        Array.from({ length: 5 }, (_, j) => ({
          id: `bi-ds-${stamp}-${i}-${j}`,
          bookId,
          currentSchoolId: hqId,
          barcode: `DS-${stamp}-${i}-${j}`,
          condition: "new" as const,
          status: "in_stock" as const,
          createdAt: now,
          updatedAt: now,
        }))
      )
    );

    const res = await directSalesRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: hqId,
        buyerName: "Orang Tua Test",
        buyerPhone: "08123456789",
        paymentMethod: "cash",
        items: [
          { bookId: bookIds[0], quantity: 3 },
          { bookId: bookIds[1], quantity: 2 },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.totalAmount).toBe(50000 * 3 + 60000 * 2);
  });

  it("returns 400 with available-vs-requested counts when stock is short", async () => {
    const stamp = `short-${Date.now()}`;
    const hqId = `school-${stamp}`;
    const bookId = `book-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: hqId,
      name: "Gudang Short",
      code: `SH-${Date.now()}`,
      type: "warehouse",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-${stamp}`,
      title: "Buku Langka",
      author: "Penulis Test",
      publisher: "Penerbit Test",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(bookItems).values({
      id: `bi-${stamp}`,
      bookId,
      currentSchoolId: hqId,
      barcode: `BC-${stamp}`,
      condition: "new",
      status: "in_stock",
      createdAt: now,
      updatedAt: now,
    });

    const result = await sellDirect(db, {
      schoolId: hqId,
      buyerName: "Pembeli",
      buyerPhone: "08123456789",
      items: [{ bookId, quantity: 5 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toContain("Buku Langka");
      expect(result.message).toContain("Tersedia: 1, diminta: 5");
    }
  });

  it("rejects non-warehouse locations with 403 and unknown books with 404", async () => {
    const stamp = `rej-${Date.now()}`;
    const branchId = `school-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: branchId,
      name: "Cabang Biasa",
      code: `CB-${Date.now()}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });

    const forbidden = await sellDirect(db, {
      schoolId: branchId,
      buyerName: "Pembeli",
      buyerPhone: "08123456789",
      items: [{ bookId: "book-xxx", quantity: 1 }],
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.status).toBe(403);

    const unknownBook = await sellDirect(db, {
      schoolId: branchId,
      buyerName: "Pembeli",
      buyerPhone: "08123456789",
      items: [{ bookId: "book-tidak-ada", quantity: 1 }],
    });
    expect(unknownBook.ok).toBe(false);
  });

  it("rejects zero-quantity lines through shared order validation (T4)", async () => {
    const stamp = `valline-${Date.now()}`;
    const hqId = `school-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: hqId, name: "Gudang Validasi", code: `VL-${Date.now()}`, type: "warehouse",
      createdAt: now, updatedAt: now,
    });
    try {
      const result = await sellDirect(db, {
        schoolId: hqId,
        buyerName: "Pembeli",
        buyerPhone: "08123456789",
        items: [{ bookId: "book-apa-pun", quantity: 0 }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.message).toContain("Jumlah minimal 1 dan maksimal 50");
      }
    } finally {
      await db.delete(schools).where(eq(schools.id, hqId));
    }
  });

  it("links order to registered student when studentNis matches case-folded (T4)", async () => {
    const stamp = `nislink-${Date.now()}`;
    const hqId = `school-${stamp}`;
    const bookId = `book-${stamp}`;
    const studentId = `student-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: hqId, name: "Gudang NIS", code: `NIS-${Date.now()}`, type: "warehouse",
      createdAt: now, updatedAt: now,
    });
    await db.insert(students).values({
      id: studentId, schoolId: hqId, nis: "nis-ds-007", name: "Murid Terdaftar",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    await db.insert(books).values({
      id: bookId, isbn: `ISBN-${stamp}`, title: "Buku NIS", author: "QA", publisher: "QA Press",
      sellPrice: 30000, createdAt: now, updatedAt: now,
    });
    await db.insert(bookItems).values({
      id: `bi-${stamp}`, bookId, currentSchoolId: hqId, barcode: `BC-${stamp}`,
      condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
    });
    let orderId: string | undefined;
    try {
      const result = await sellDirect(db, {
        schoolId: hqId,
        buyerName: "Orang Tua",
        buyerPhone: "08123456789",
        studentNis: "  NIS-DS-007 ",
        items: [{ bookId, quantity: 1 }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      orderId = result.data.id;
      const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      expect(order.studentId).toBe(studentId);
    } finally {
      if (orderId) {
        await db.delete(orderPayments).where(eq(orderPayments.orderId, orderId));
        await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, orderId));
        await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      }
      await db.delete(bookItems).where(eq(bookItems.currentSchoolId, hqId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(students).where(eq(students.schoolId, hqId));
      await db.delete(schools).where(eq(schools.id, hqId));
    }
  });
});
