import { describe, expect, it } from "bun:test";
import { demoRouter } from "./demo";
import { db } from "../../db";
import { schools, bookPackages, students, studentBookOrders, suppliers, purchaseOrders } from "../../db/schema";
import { eq } from "drizzle-orm";

describe("Revamped Demo Seeding API", () => {
  it("seeds full operational school environment with students, packages, suppliers, and order scenarios", async () => {
    const res = await demoRouter.request("/seed", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.schoolsSeeded).toBe(4);
    expect(json.data.booksSeeded).toBe(12);
    expect(json.data.packagesSeeded).toBe(3);
    expect(json.data.studentsSeeded).toBe(4);

    // 1. Verify Al Wildan HQ
    const [hq] = await db.select().from(schools).where(eq(schools.id, "school-alw-1"));
    expect(hq).toBeDefined();
    expect(hq.type).toBe("main");

    // 2. Verify Hendra Wahyudi (promoted to grade 2)
    const [hendra] = await db.select().from(students).where(eq(students.name, "Hendra Wahyudi"));
    expect(hendra).toBeDefined();
    expect(hendra.status).toBe("promoted");

    // 3. Verify packages exist
    const pkgs = await db.select().from(bookPackages);
    expect(pkgs.length).toBeGreaterThanOrEqual(3);

    // 4. Verify realistic orders
    const orders = await db.select().from(studentBookOrders);
    expect(orders.length).toBeGreaterThanOrEqual(4);

    // 5. Verify supplier and purchase order
    const [sup] = await db.select().from(suppliers).where(eq(suppliers.code, "SUP-ERL"));
    expect(sup).toBeDefined();

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, "PO-202609-0088"));
    expect(po).toBeDefined();
    expect(po.status).toBe("partially_received");
  });
});
