import { describe, expect, it, afterEach } from "bun:test";
import { usersRouter } from "./users";
import { db } from "../../db";
import { users, schools } from "../../db/schema";
import { eq } from "drizzle-orm";
import { mockActor, restoreActor } from "./test-actor";

type StaffRole = "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin";
afterEach(() => {
  restoreActor();
});

const centralPayload = {
  name: "Central Probe",
  email: "probe.central@example.com",
  password: "password123",
  role: "central_admin",
};

describe("Users API & School Assignment", () => {
  it("creates and assigns users to schools with role checks", async () => {
    mockActor("central_admin", null);
    // Setup test school
    const testSchoolId = "test-user-school-1";
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await db.insert(schools).values({
      id: testSchoolId,
      name: "Test User Branch",
      code: "TEST-UB1",
      type: "branch",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Cleanup previous test users
    await db.delete(users).where(eq(users.email, "test.branch.admin@example.com"));
    await db.delete(users).where(eq(users.email, "test.central.admin@example.com"));

    // 1. Branch admin creation requires schoolId
    const resFailBranch = await usersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Branch Admin Without School",
        email: "fail.branch@example.com",
        password: "password123",
        role: "branch_admin",
      }),
    });
    expect(resFailBranch.status).toBe(400);

    // 2. Successful creation of Branch Admin
    const resBranch = await usersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Branch Admin Valid",
        email: "test.branch.admin@example.com",
        password: "password123",
        role: "branch_admin",
        schoolId: testSchoolId,
      }),
    });
    const branchJson = await resBranch.json();
    expect(resBranch.status).toBe(201);
    expect(branchJson.data.email).toBe("test.branch.admin@example.com");

    // 3. Successful creation of Central Admin
    const resCentral = await usersRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Central Admin Valid",
        email: "test.central.admin@example.com",
        password: "password123",
        role: "central_admin",
      }),
    });
    expect(resCentral.status).toBe(201);

    // 4. Fetch list of users
    const resList = await usersRouter.request("/", { method: "GET" });
    const listJson = await resList.json();
    expect(resList.status).toBe(200);
    expect(listJson.data.some((u: any) => u.email === "test.branch.admin@example.com")).toBe(true);

    // 5. Update user role
    const createdUserId = branchJson.data.id;
    const resUpdate = await usersRouter.request(`/${createdUserId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Branch Admin Updated Name",
      }),
    });
    const updateJson = await resUpdate.json();
    expect(resUpdate.status).toBe(200);
    expect(updateJson.data.name).toBe("Branch Admin Updated Name");
  });
});

describe("Users RBAC (#41): central only", () => {
  it("rejects anonymous callers with 401 on list, create, and update", async () => {
    mockActor(null, null);
    expect((await usersRouter.request("/", { method: "GET" })).status).toBe(401);
    expect(
      (
        await usersRouter.request("/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(centralPayload),
        })
      ).status
    ).toBe(401);
    expect(
      (
        await usersRouter.request("/ghost-id", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Ghost Renamed" }),
        })
      ).status
    ).toBe(401);
  });

  it("rejects school/branch/warehouse admins with 403 on all three endpoints", async () => {
    const roles: Array<{ role: StaffRole; schoolId: string }> = [
      { role: "school_admin", schoolId: "school-alw-1" },
      { role: "branch_admin", schoolId: "school-alw-1" },
      { role: "warehouse_admin", schoolId: "school-warehouse" },
    ];
    for (const { role, schoolId } of roles) {
      mockActor(role, schoolId);
      expect((await usersRouter.request("/", { method: "GET" })).status).toBe(403);
      expect(
        (
          await usersRouter.request("/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(centralPayload),
          })
        ).status
      ).toBe(403);
      expect(
        (
          await usersRouter.request("/ghost-id", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Ghost Renamed" }),
          })
        ).status
      ).toBe(403);
    }
  });

  it("lets central admin list users", async () => {
    mockActor("central_admin", null);
    const res = await usersRouter.request("/", { method: "GET" });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
