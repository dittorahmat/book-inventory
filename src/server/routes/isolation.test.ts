import { describe, expect, it, afterEach } from "bun:test";
import { db } from "../../db";
import { schools, books, bookItems, students, studentBookOrders, transferShipments } from "../../db/schema";
import { auth } from "../auth";
import { bookItemsRouter } from "./bookItems";
import { studentOrdersRouter } from "./student-orders";
import { studentsRouter } from "./students";
import { paymentsRouter } from "./payments";
import { shipmentsRouter } from "./shipments";
import { procurementRouter } from "./procurement";

const stamp = Date.now().toString().slice(-8);
const SCHOOL_A = `school-iso-a-${stamp}`;
const SCHOOL_B = `school-iso-b-${stamp}`;
const BOOK = `b-iso-${stamp}`;
const now = new Date().toISOString();

async function seedPair() {
  for (const [id, code] of [[SCHOOL_A, `ISOA-${stamp}`], [SCHOOL_B, `ISOB-${stamp}`]] as const) {
    await db.insert(schools).values({ id, name: `Iso ${code}`, code, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
  }
  await db.insert(books).values({ id: BOOK, isbn: `ISBN-ISO-${stamp}`, title: "Isolation Probe", author: "QA", publisher: "QA", createdAt: now, updatedAt: now }).onConflictDoNothing();
  for (const sid of [SCHOOL_A, SCHOOL_B]) {
    await db.insert(bookItems).values({
      id: `bi-iso-${sid}`, bookId: BOOK, currentSchoolId: sid,
      barcode: `ISO-${stamp}-${sid}`, condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const stuId = `stu-iso-${sid}`;
    await db.insert(students).values({
      id: stuId, schoolId: sid, nis: `NIS-${stamp}-${sid}`, name: `Siswa ${sid}`,
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(studentBookOrders).values({
      id: `ord-iso-${sid}`, orderNumber: `ORD-ISO-${stamp}-${sid}`, studentId: stuId, schoolId: sid,
      totalAmount: 100000, paidAmount: 0, createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
  }
  await db.insert(transferShipments).values({
    id: `trf-iso-${stamp}`, shipmentNumber: `TRF-ISO-${stamp}`,
    fromSchoolId: SCHOOL_B, toSchoolId: SCHOOL_A, status: "draft", createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
}

type Role = "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin";
const realGetSession = auth.api.getSession;
function actAs(role: Role | null, schoolId: string | null) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-test", role, schoolId } } as any) : null;
}
afterEach(() => {
  (auth.api as any).getSession = realGetSession;
});

describe("Role & location isolation across routes", () => {
  it("scopes book items, students, orders, payments, shipments and PO mutations", async () => {
    await seedPair();

    // --- school_admin of A ---
    actAs("school_admin", SCHOOL_A);

    const itemsRes = await bookItemsRouter.request("/", { method: "GET" });
    const itemsJson = await itemsRes.json();
    expect(itemsRes.status).toBe(200);
    expect(itemsJson.data.every((i: any) => i.barcode.includes(SCHOOL_A))).toBe(true);

    const crossList = await bookItemsRouter.request(`/?schoolId=${SCHOOL_B}`, { method: "GET" });
    expect(crossList.status).toBe(403);

    const crossBarcode = await bookItemsRouter.request(`/barcode/ISO-${stamp}-${SCHOOL_B}`, { method: "GET" });
    expect(crossBarcode.status).toBe(403);
    const ownBarcode = await bookItemsRouter.request(`/barcode/ISO-${stamp}-${SCHOOL_A}`, { method: "GET" });
    expect(ownBarcode.status).toBe(200);

    const crossGen = await bookItemsRouter.request("/batch-generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: BOOK, schoolId: SCHOOL_B, count: 1 }),
    });
    expect(crossGen.status).toBe(403);

    const crossStudents = await studentsRouter.request(`/?schoolId=${SCHOOL_B}`, { method: "GET" });
    expect(crossStudents.status).toBe(403);
    const ownStudents = await studentsRouter.request("/", { method: "GET" });
    const ownStudentsJson = await ownStudents.json();
    expect(ownStudentsJson.data.every((s: any) => s.schoolId === SCHOOL_A)).toBe(true);

    const crossOrders = await studentOrdersRouter.request(`/?schoolId=${SCHOOL_B}`, { method: "GET" });
    expect(crossOrders.status).toBe(403);
    const ownOrders = await studentOrdersRouter.request("/", { method: "GET" });
    const ownOrdersJson = await ownOrders.json();
    expect(ownOrdersJson.data.every((o: any) => o.schoolId === SCHOOL_A)).toBe(true);

    const crossPay = await paymentsRouter.request(`/orders/ord-iso-${SCHOOL_B}`, { method: "GET" });
    expect(crossPay.status).toBe(403);
    const ownPay = await paymentsRouter.request(`/orders/ord-iso-${SCHOOL_A}`, { method: "GET" });
    expect(ownPay.status).toBe(200);

    // Shipment B->A involves A, so visible; an unrelated one must be hidden.
    const involved = await shipmentsRouter.request(`/trf-iso-${stamp}`, { method: "GET" });
    expect(involved.status).toBe(200);

    // PO mutations are logistics-only: school admin is refused even for own school.
    const poAttempt = await procurementRouter.request("/purchase-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: "x", targetSchoolId: SCHOOL_A, orderDate: "2026-09-30", items: [{ bookId: BOOK, quantityOrdered: 1, unitPrice: 1000 }] }),
    });
    expect(poAttempt.status).toBe(403);

    // --- unrelated third school sees nothing of the pair ---
    actAs("school_admin", "school-alw-9");
    const alien = await shipmentsRouter.request(`/trf-iso-${stamp}`, { method: "GET" });
    expect(alien.status).toBe(403);
    const alienOrders = await studentOrdersRouter.request(`/?schoolId=${SCHOOL_A}`, { method: "GET" });
    expect(alienOrders.status).toBe(403);

    // --- central admin roams freely ---
    actAs("central_admin", null);
    const centralItems = await bookItemsRouter.request(`/?schoolId=${SCHOOL_B}`, { method: "GET" });
    expect(centralItems.status).toBe(200);

    // --- unauthenticated keeps legacy open access ---
    actAs(null, null);
    const legacy = await bookItemsRouter.request("/", { method: "GET" });
    expect(legacy.status).toBe(200);
  });
});
