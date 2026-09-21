import { describe, expect, it } from "bun:test";
import { schoolsRouter } from "./schools";
import { db } from "../../db";
import { schools } from "../../db/schema";
import { eq } from "drizzle-orm";

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
