import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { schoolsRouter } from "./schools";
import { db } from "../../db";
import { schools } from "../../db/schema";
import { eq } from "drizzle-orm";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});

describe("Schools API & Branch Management", () => {
  it("registers main school and branch school cleanly", async () => {
    // Cleanup any existing test schools or existing main school to test registration
    await db.delete(schools).where(eq(schools.type, "main"));
    await db.delete(schools).where(eq(schools.code, "TEST-MAIN"));
    await db.delete(schools).where(eq(schools.code, "TEST-BR1"));

    // Create Main School
    const resMain = await schoolsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test HQ Central School",
        code: "TEST-MAIN",
        type: "main",
        address: "Central Blvd 1",
      }),
    });
    const mainJson = await resMain.json();
    expect(resMain.status).toBe(201);
    expect(mainJson.data.type).toBe("main");
    expect(mainJson.data.code).toBe("TEST-MAIN");

    // Create Branch School
    const resBranch = await schoolsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Branch North",
        code: "TEST-BR1",
        type: "branch",
        address: "North Avenue 5",
      }),
    });
    const branchJson = await resBranch.json();
    expect(resBranch.status).toBe(201);
    expect(branchJson.data.type).toBe("branch");

    // Fetch school list
    const resList = await schoolsRouter.request("/", { method: "GET" });
    const listJson = await resList.json();
    expect(resList.status).toBe(200);
    expect(listJson.data.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Schools master RBAC (#43)", () => {
  const stamp = Date.now().toString().slice(-6);

  function createPayload(code: string) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Sekolah RBAC ${code}`, code, type: "branch" }),
    } as const;
  }

  it("menolak mutasi lokasi tanpa sesi (401) dan oleh peran sekolah (403), mengizinkan gudang", async () => {
    mockActor("central_admin", null);
    const seeded = await schoolsRouter.request("/", createPayload(`RBAC-PUT-${stamp}`));
    expect(seeded.status).toBe(201);
    const targetId = (await seeded.json()).data.id;

    const putTarget = {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "Coba Ubah" }),
    } as const;

    mockActor(null, null);
    expect((await schoolsRouter.request("/", createPayload(`RBAC-${stamp}`))).status).toBe(401);
    expect((await schoolsRouter.request(`/${targetId}`, putTarget)).status).toBe(401);

    mockActor("school_admin", "school-alw-1");
    expect((await schoolsRouter.request("/", createPayload(`RBAC-${stamp}`))).status).toBe(403);
    expect((await schoolsRouter.request(`/${targetId}`, putTarget)).status).toBe(403);

    mockActor("warehouse_admin", "school-warehouse");
    expect((await schoolsRouter.request("/", createPayload(`RBAC-${stamp}`))).status).toBe(201);
    expect((await schoolsRouter.request(`/${targetId}`, putTarget)).status).toBe(200);
  });

  it("membiarkan daftar dan detail sekolah terbaca publik", async () => {
    mockActor(null, null);
    const list = await schoolsRouter.request("/", { method: "GET" });
    expect(list.status).toBe(200);
    const firstId = ((await list.json()) as any).data[0]?.id;
    expect(firstId).toBeDefined();
    expect((await schoolsRouter.request(`/${firstId}`, { method: "GET" })).status).toBe(200);
  });

  it("supports managing allowed standalone books per school and grade", async () => {
    mockActor("central_admin", null);
    const stamp = Date.now();
    const schoolRes = await schoolsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Sekolah Allowed ${stamp}`, code: `SAL-${stamp}`, type: "branch" }),
    });
    const school = (await schoolRes.json()).data;

    const { books } = await import("../../db/schema");
    const bookId = `book-allw-${stamp}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `978-ALW-${stamp}`,
      title: "Buku Suplemen Khusus",
      author: "Penulis Khusus",
      publisher: "Penerbit Khusus",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Add allowed book
    const addRes = await schoolsRouter.request(`/${school.id}/allowed-books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gradeLevel: "5", bookId }),
    });
    expect(addRes.status).toBe(201);
    const added = (await addRes.json()).data;

    // List allowed books
    const listRes = await schoolsRouter.request(`/${school.id}/allowed-books?gradeLevel=5`);
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { data: Array<{ bookId: string }> };
    expect(listJson.data.some((b) => b.bookId === bookId)).toBe(true);

    // Delete allowed book
    const delRes = await schoolsRouter.request(`/${school.id}/allowed-books/${added.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    // Cleanup
    await db.delete(books).where(eq(books.id, bookId));
    await db.delete(schools).where(eq(schools.id, school.id));
  });
});
