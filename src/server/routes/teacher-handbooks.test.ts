import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { books, schools, teacherHandbookOrders } from "../../db/schema";
import { auth } from "../auth";
import { app } from "../index";
import { createTestBook, createTestSchool } from "../lib/test-fixtures";

describe("teacherHandbooksRouter", () => {
  const createdOrderIds: string[] = [];
  const createdBookIds: string[] = [];
  const createdSchoolIds: string[] = [];

  beforeEach(async () => {
    // Ensure clean state per test
  });

  afterEach(async () => {
    for (const id of createdOrderIds.splice(0)) {
      await db.delete(teacherHandbookOrders).where(eq(teacherHandbookOrders.id, id));
    }
    for (const id of createdBookIds.splice(0)) {
      await db.delete(books).where(eq(books.id, id));
    }
    for (const id of createdSchoolIds.splice(0)) {
      await db.delete(schools).where(eq(schools.id, id));
    }
  });

  it("allows school_admin to create, list, update, and cancel a teacher handbook order while pending", async () => {
    const school = await createTestSchool(db, { name: "Cabang Test PG" });
    createdSchoolIds.push(school.id);
    const book = await createTestBook(db, { title: "Buku Pegangan Matematika", price: 55000 });
    createdBookIds.push(book.id);

    const sessionSpy = spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "user-pg-test", role: "school_admin", schoolId: school.id } as never,
      session: { id: "sess-pg-test" } as never,
    });

    const headers = {
      "Content-Type": "application/json",
    };

    const createRes = await app.request("/api/teacher-handbooks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        notes: "Kebutuhan semester ganjil",
        allocations: [
          {
            bookId: book.id,
            teacherName: "Ustadz Ahmad",
            gradeLevel: "4",
            rombel: "INTER 1",
            subject: "Matematika",
            quantity: 2,
          },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { success: boolean; data: { id: string; status: string; allocations: Array<{ teacherName: string; quantity: number }> } };
    expect(created.success).toBe(true);
    expect(created.data.status).toBe("pending");
    expect(created.data.allocations).toHaveLength(1);
    expect(created.data.allocations[0]?.teacherName).toBe("Ustadz Ahmad");
    createdOrderIds.push(created.data.id);

    const listRes = await app.request("/api/teacher-handbooks", { headers });
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as { success: boolean; data: Array<{ id: string }> };
    expect(listed.data.some((o) => o.id === created.data.id)).toBe(true);

    const updateRes = await app.request(`/api/teacher-handbooks/${created.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        notes: "Revisi jumlah",
        allocations: [
          {
            bookId: book.id,
            teacherName: "Ustadz Ahmad",
            gradeLevel: "4",
            rombel: "INTER 1",
            subject: "Matematika",
            quantity: 3,
          },
        ],
      }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { success: boolean; data: { allocations: Array<{ quantity: number }> } };
    expect(updated.data.allocations[0]?.quantity).toBe(3);

    const cancelRes = await app.request(`/api/teacher-handbooks/${created.data.id}/cancel`, {
      method: "POST",
      headers,
    });
    expect(cancelRes.status).toBe(200);
    const cancelled = (await cancelRes.json()) as { success: boolean; data: { status: string } };
    expect(cancelled.data.status).toBe("cancelled");

    const editAfterCancel = await app.request(`/api/teacher-handbooks/${created.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        allocations: [
          { bookId: book.id, teacherName: "Ustadz Ahmad", quantity: 1 },
        ],
      }),
    });
    expect(editAfterCancel.status).toBe(400);
    sessionSpy.mockRestore();
  });

  it("supports dispatch (Surat Jalan), branch receive, teacher reassign, and handover to completion", async () => {
    const school = await createTestSchool(db, { name: "Cabang Test PG 2" });
    createdSchoolIds.push(school.id);
    const book = await createTestBook(db, { title: "Buku Pegangan IPA", price: 60000 });
    createdBookIds.push(book.id);

    const sessionSpy = spyOn(auth.api, "getSession").mockResolvedValue({
      user: { id: "user-pg-central", role: "central_admin", schoolId: null } as never,
      session: { id: "sess-pg-central" } as never,
    });

    const headers = { "Content-Type": "application/json" };
    const createRes = await app.request("/api/teacher-handbooks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        schoolId: school.id,
        allocations: [{ bookId: book.id, teacherName: "Ustadzah Fatimah", quantity: 2 }],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: { id: string; allocations: Array<{ id: string }> };
    };
    createdOrderIds.push(created.data.id);
    const allocId = created.data.allocations[0]!.id;

    const dispatchRes = await app.request(`/api/teacher-handbooks/${created.data.id}/dispatch`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(dispatchRes.status).toBe(200);
    const dispatched = (await dispatchRes.json()) as { data: { status: string } };
    expect(dispatched.data.status).toBe("in_transit");

    const receiveRes = await app.request(`/api/teacher-handbooks/${created.data.id}/receive`, {
      method: "POST",
      headers,
    });
    expect(receiveRes.status).toBe(200);
    const received = (await receiveRes.json()) as { data: { status: string } };
    expect(received.data.status).toBe("received");

    const reassignRes = await app.request(`/api/teacher-handbooks/allocations/${allocId}/reassign`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ teacherName: "Ustadzah Aisyah" }),
    });
    expect(reassignRes.status).toBe(200);

    const handoverRes = await app.request(`/api/teacher-handbooks/allocations/${allocId}/handover`, {
      method: "POST",
      headers,
      body: JSON.stringify({ quantity: 2 }),
    });
    expect(handoverRes.status).toBe(200);
    const completed = (await handoverRes.json()) as { data: { status: string } };
    expect(completed.data.status).toBe("completed");

    sessionSpy.mockRestore();
  });
});
