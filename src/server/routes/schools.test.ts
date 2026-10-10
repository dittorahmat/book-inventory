import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { schoolsRouter } from "./schools";
import { db } from "../../db";
import { schools } from "../../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";

const realGetSession = auth.api.getSession;
function actAs(role: "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin" | null, schoolId: string | null = null) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-test", role, schoolId } } as any) : null;
}
beforeEach(() => actAs("central_admin", null));
afterEach(() => {
  (auth.api as any).getSession = realGetSession;
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

  it("menolak mutasi lokasi tanpa sesi (401) dan oleh peran sekolah (403)", async () => {
    actAs(null, null);
    expect((await schoolsRouter.request("/", createPayload(`RBAC-${stamp}`))).status).toBe(401);
    expect((await schoolsRouter.request("/school-alw-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "Coba Ubah" }),
    })).status).toBe(401);

    actAs("school_admin", "school-alw-1");
    expect((await schoolsRouter.request("/", createPayload(`RBAC-${stamp}`))).status).toBe(403);
    expect((await schoolsRouter.request("/school-alw-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "Coba Ubah" }),
    })).status).toBe(403);

    actAs("warehouse_admin", "school-warehouse");
    expect((await schoolsRouter.request("/", createPayload(`RBAC-${stamp}`))).status).toBe(403);
  });

  it("membiarkan daftar dan detail sekolah terbaca publik", async () => {
    actAs(null, null);
    const list = await schoolsRouter.request("/", { method: "GET" });
    expect(list.status).toBe(200);
    const firstId = ((await list.json()) as any).data[0]?.id;
    expect(firstId).toBeDefined();
    expect((await schoolsRouter.request(`/${firstId}`, { method: "GET" })).status).toBe(200);
  });
});
