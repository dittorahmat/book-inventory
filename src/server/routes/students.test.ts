import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { studentsRouter } from "./students";
import { db } from "../../db";
import { schools } from "../../db/schema";

const now = () => new Date().toISOString();

async function seedSchool(id: string, code: string) {
  await db.insert(schools).values({
    id,
    name: `Sekolah ${id}`,
    code,
    type: "branch",
    createdAt: now(),
    updatedAt: now(),
  }).onConflictDoNothing();
}

describe("Students admin API", () => {
  it("creates with custom seeded string IDs and server UUIDs, then updates", async () => {
    const stamp = Date.now();
    const schoolId = `school-stu-${stamp}`;
    await seedSchool(schoolId, `ALW-STU-${stamp}`);

    // Custom seeded string ID (slug style, NOT uuid)
    const customId = `siswa-arkan-${stamp}`;
    const createCustom = await studentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customId,
        schoolId,
        nis: `NIS${String(stamp).slice(-6)}A`,
        name: "Arkan",
        gender: "male",
        gradeLevel: "1",
        curriculumType: "international",
        academicYear: "2026/2027",
        parentName: "Ortu Arkan",
        parentEmail: "arkan@example.com",
        parentPhone: "+628100000011",
      }),
    });
    expect(createCustom.status).toBe(201);
    const customJson = await createCustom.json();
    expect(customJson.data.id).toBe(customId);
    expect(customJson.data.status).toBe("active");

    // Server-generated UUID
    const createUuid = await studentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        nis: `NIS${String(stamp).slice(-6)}B`,
        name: "Bila",
        gradeLevel: "2",
        academicYear: "2026/2027",
      }),
    });
    expect(createUuid.status).toBe(201);
    const uuidJson = await createUuid.json();
    expect(uuidJson.data.id).toBeString();
    expect(uuidJson.data.id.length).toBeGreaterThan(10);

    // Update with custom ID
    const updateRes = await studentsRouter.request(`/${customId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gradeLevel: "2", parentPhone: "+628100000099" }),
    });
    expect(updateRes.status).toBe(200);
    const updateJson = await updateRes.json();
    expect(updateJson.data.gradeLevel).toBe("2");
  });

  it("rejects duplicate NIS on create and approve", async () => {
    const stamp = Date.now();
    const schoolId = `school-nis-${stamp}`;
    await seedSchool(schoolId, `ALW-NIS-${stamp}`);

    const base = {
      schoolId,
      name: "Siswa NIS",
      gradeLevel: "1",
      academicYear: "2026/2027",
    };
    const first = await studentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...base, nis: `DUP${stamp}` }),
    });
    expect(first.status).toBe(201);

    const dup = await studentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...base, name: "Siswa NIS 2", nis: `DUP${stamp}` }),
    });
    expect(dup.status).toBe(400);
    const dupJson = await dup.json();
    expect(dupJson.message).toContain("NIS");
  });

  it("verifies pending students via approve (with official NIS) and reject", async () => {
    const stamp = Date.now();
    const schoolId = `school-ver-${stamp}`;
    await seedSchool(schoolId, `ALW-VER-${stamp}`);

    const pendingId = `siswa-pending-${stamp}`;
    const created = await studentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: pendingId,
        schoolId,
        nis: `REG-${String(stamp).slice(-6)}`,
        name: "Calon Siswa",
        gradeLevel: "1",
        academicYear: "2026/2027",
        status: "new_pending",
      }),
    });
    expect(created.status).toBe(201);

    // Approve without NIS -> 400
    const noNis = await studentsRouter.request(`/${pendingId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    expect(noNis.status).toBe(400);

    // Approve with official NIS -> active
    const officialNis = `OFF${String(stamp).slice(-6)}`;
    const approved = await studentsRouter.request(`/${pendingId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", nis: officialNis }),
    });
    expect(approved.status).toBe(200);
    const approvedJson = await approved.json();
    expect(approvedJson.data.status).toBe("active");
    expect(approvedJson.data.nis).toBe(officialNis);

    // Reject another pending student
    const pending2 = await studentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        nis: `REG2-${String(stamp).slice(-6)}`,
        name: "Calon Ditolak",
        gradeLevel: "1",
        academicYear: "2026/2027",
        status: "new_pending",
      }),
    });
    const pending2Json = await pending2.json();
    const rejected = await studentsRouter.request(`/${pending2Json.data.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    expect(rejected.status).toBe(200);
    const rejectedJson = await rejected.json();
    expect(rejectedJson.data.status).toBe("rejected");
  });

  it("lists with school isolation, status filter, and deletes", async () => {
    const stamp = Date.now();
    const schoolA = `school-iso-a-${stamp}`;
    const schoolB = `school-iso-b-${stamp}`;
    await seedSchool(schoolA, `ALW-ISOA-${stamp}`);
    await seedSchool(schoolB, `ALW-ISOB-${stamp}`);

    const mk = (schoolId: string, nis: string, name: string) =>
      studentsRouter.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, nis, name, gradeLevel: "3", academicYear: "2026/2027" }),
      });

    await mk(schoolA, `ISOA${stamp}`, `Anak A ${stamp}`);
    const delRes = await mk(schoolB, `ISOB${stamp}`, `Anak B ${stamp}`);
    const delJson = await delRes.json();

    const listA = await studentsRouter.request(`/?schoolId=${schoolA}`);
    const listAJson = await listA.json();
    expect(listAJson.data.every((s: any) => s.schoolId === schoolA)).toBe(true);
    expect(listAJson.data.some((s: any) => s.name === `Anak A ${stamp}`)).toBe(true);

    const pendingOnly = await studentsRouter.request(`/?schoolId=${schoolA}&status=new_pending`);
    const pendingJson = await pendingOnly.json();
    expect(pendingJson.data.every((s: any) => s.status === "new_pending")).toBe(true);

    const search = await studentsRouter.request(`/?search=${encodeURIComponent(`Anak B ${stamp}`)}`);
    const searchJson = await search.json();
    expect(searchJson.data.some((s: any) => s.name === `Anak B ${stamp}`)).toBe(true);

    const del = await studentsRouter.request(`/${delJson.data.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    const afterDel = await studentsRouter.request(`/?search=${encodeURIComponent(`Anak B ${stamp}`)}`);
    const afterDelJson = await afterDel.json();
    expect(afterDelJson.data.some((s: any) => s.name === `Anak B ${stamp}`)).toBe(false);
  });

  it("blocks deleting a student who has book orders and returns order numbers in message", async () => {
    const { studentBookOrders } = await import("../../db/schema");
    const stamp = Date.now();
    const schoolId = `school-ord-${stamp}`;
    await seedSchool(schoolId, `ALW-ORD-${stamp}`);

    const res = await studentsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, nis: `ORD${stamp}`, name: "Siswa Berpesanan", gradeLevel: "5", academicYear: "2026/2027" }),
    });
    const { data: st } = await res.json();

    const orderNumber = `ORD-TEST-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: `sbo-test-${stamp}`,
      orderNumber,
      studentId: st.id,
      schoolId,
      orderType: "regular",
      paymentStatus: "unpaid",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: 150000,
      paidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Delete student -> must fail with 400 and state the order number
    const delRes = await studentsRouter.request(`/${st.id}`, { method: "DELETE" });
    const delJson = await delRes.json();
    expect(delRes.status).toBe(400);
    expect(delJson.success).toBe(false);
    expect(delJson.message).toContain(orderNumber);

    // Clean up order first
    await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `sbo-test-${stamp}`));

    // Now delete succeeds
    const delRes2 = await studentsRouter.request(`/${st.id}`, { method: "DELETE" });
    expect(delRes2.status).toBe(200);
  });
});
