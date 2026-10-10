import { describe, expect, it, afterEach } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { schools, books, bookItems, students, studentBookOrders, transferShipments, internalPurchaseOrders, users } from "../../db/schema";
import { auth } from "../auth";
import { bookItemsRouter } from "./bookItems";
import { studentOrdersRouter } from "./student-orders";
import { studentsRouter } from "./students";
import { paymentsRouter } from "./payments";
import { shipmentsRouter } from "./shipments";
import { procurementRouter } from "./procurement";
import { dashboardRouter } from "./dashboard";
import { stockSummaryRouter } from "./stock-summary";
import { salesReportRouter } from "./sales-report";
import { packagesRouter } from "./packages";
import { internalOrdersRouter } from "./internal-orders";
import { directSalesRouter } from "./direct-sales";
import { vendorReturnsRouter } from "./vendor-returns";
import { poWorkflowRouter } from "./po-workflow";
import { demoRouter } from "./demo";
import { publicOrdersRouter } from "./public-orders";
import { schoolsRouter } from "./schools";
import { booksRouter } from "./books";

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

    // --- unauthenticated is rejected everywhere since #44 ---
    actAs(null, null);
    const denied = await bookItemsRouter.request("/", { method: "GET" });
    expect(denied.status).toBe(401);
  });
});

describe("Staff login gate (#44): anonymous callers get 401 on every staff router", () => {
  it("rejects anonymous reads across all staff routers, keeps public portal open", async () => {
    await seedPair();
    actAs(null, null);
    const anonGet = (router: { request: (path: string, init?: RequestInit) => Response | Promise<Response> }, path: string) =>
      router.request(path, { method: "GET" });

    expect((await anonGet(studentsRouter, "/")).status).toBe(401);
    expect((await anonGet(studentOrdersRouter, "/")).status).toBe(401);
    expect((await anonGet(studentOrdersRouter, "/returns")).status).toBe(401);
    expect((await anonGet(paymentsRouter, `/orders/ord-iso-${SCHOOL_A}`)).status).toBe(401);
    expect((await anonGet(dashboardRouter, "/summary")).status).toBe(401);
    expect((await anonGet(stockSummaryRouter, "/loose")).status).toBe(401);
    expect((await anonGet(stockSummaryRouter, "/packages")).status).toBe(401);
    expect((await anonGet(stockSummaryRouter, "/overview")).status).toBe(401);
    expect((await anonGet(salesReportRouter, "/?from=2026-01-01&to=2026-12-31")).status).toBe(401);
    expect((await anonGet(shipmentsRouter, "/")).status).toBe(401);
    expect((await anonGet(packagesRouter, "/")).status).toBe(401);
    expect((await anonGet(procurementRouter, "/suppliers")).status).toBe(401);
    expect((await anonGet(procurementRouter, "/purchase-orders")).status).toBe(401);
    expect((await anonGet(procurementRouter, "/purchase-orders/ghost-po/receipts")).status).toBe(401);
    expect((await anonGet(internalOrdersRouter, "/")).status).toBe(401);
    expect((await anonGet(internalOrdersRouter, "/ghost-ipo/shipments")).status).toBe(401);
    expect((await anonGet(bookItemsRouter, "/")).status).toBe(401);
    expect((await anonGet(vendorReturnsRouter, "/")).status).toBe(401);

    const anonPrint = await poWorkflowRouter.request("/purchase-orders/ghost-po/print", { method: "POST" });
    expect(anonPrint.status).toBe(401);

    const anonSale = await directSalesRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "school-warehouse",
        buyerName: "Ortu Anon",
        buyerPhone: "081234567890",
        items: [{ bookId: BOOK, quantity: 1 }],
      }),
    });
    expect(anonSale.status).toBe(401);

    // Public portal stays open without session.
    const search = await publicOrdersRouter.request(`/search-students?query=Siswa&schoolId=${SCHOOL_A}`, { method: "GET" });
    expect(search.status).toBe(200);
    expect((await search.json()).success).toBe(true);

    const badSubmit = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(badSubmit.status).not.toBe(401);

    // Public catalog reads stay open.
    expect((await anonGet(schoolsRouter, "/")).status).toBe(200);
    expect((await anonGet(booksRouter, "/")).status).toBe(200);
  });

  it("locks demo reseed to central (anon 401, school 403, central 200)", async () => {
    actAs(null, null);
    expect((await demoRouter.request("/seed", { method: "POST" })).status).toBe(401);

    actAs("school_admin", SCHOOL_A);
    expect((await demoRouter.request("/seed", { method: "POST" })).status).toBe(403);

    actAs("central_admin", null);
    const seeded = await demoRouter.request("/seed", { method: "POST" });
    expect(seeded.status).toBe(200);
    expect((await seeded.json()).success).toBe(true);
  });

  it("stops one branch from peeking another branch's internal shipment history", async () => {
    await seedPair();
    const ipoId = `ipo-iso-${stamp}`;
    await db.insert(internalPurchaseOrders).values({
      id: ipoId,
      poNumber: `IPO-ISO-${stamp}`,
      schoolId: SCHOOL_A,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    actAs(null, null);
    expect((await internalOrdersRouter.request(`/${ipoId}/shipments`, { method: "GET" })).status).toBe(401);

    actAs("school_admin", SCHOOL_B);
    expect((await internalOrdersRouter.request(`/${ipoId}/shipments`, { method: "GET" })).status).toBe(403);

    actAs("school_admin", SCHOOL_A);
    expect((await internalOrdersRouter.request(`/${ipoId}/shipments`, { method: "GET" })).status).toBe(200);

    actAs("central_admin", null);
    expect((await internalOrdersRouter.request(`/${ipoId}/shipments`, { method: "GET" })).status).toBe(200);
  });
});

describe("Account roles per organization (#46)", () => {
  it("seeds gudang as central admin and ALW-1 as scoped school admin", async () => {
    const rows = await db.select().from(users);
    const byEmail = Object.fromEntries(rows.map((u: { email: string }) => [u.email, u]));
    expect(byEmail["admin.gudang@alwildan.sch.id"]?.role).toBe("central_admin");
    expect(byEmail["admin.gudang@alwildan.sch.id"]?.schoolId).toBe("school-warehouse");
    expect(byEmail["admin.pusat@alwildan.sch.id"]?.role).toBe("school_admin");
    expect(byEmail["admin.pusat@alwildan.sch.id"]?.schoolId).toBe("school-alw-1");
  });

  it("gudang login sees all locations", async () => {
    await seedPair();
    actAs("central_admin", "school-warehouse");

    const all = await bookItemsRouter.request("/", { method: "GET" });
    expect(all.status).toBe(200);
    const barcodes = ((await all.json()).data as any[]).map((i) => i.barcode as string);
    expect(barcodes.some((b) => b.includes(SCHOOL_A))).toBe(true);
    expect(barcodes.some((b) => b.includes(SCHOOL_B))).toBe(true);

    const scoped = await bookItemsRouter.request(`/?schoolId=${SCHOOL_B}`, { method: "GET" });
    expect(scoped.status).toBe(200);
  });

  it("ALW-1 admin is locked to school-alw-1 (cross-school read → 403)", async () => {
    await seedPair();
    const probeId = `bi-46-alw1-${stamp}`;
    await db.insert(bookItems).values({
      id: probeId, bookId: BOOK, currentSchoolId: "school-alw-1",
      barcode: `ALW1-46-${stamp}`, condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    try {
      actAs("school_admin", "school-alw-1");

      const own = await bookItemsRouter.request("/", { method: "GET" });
      expect(own.status).toBe(200);
      const rows = (await own.json()).data as any[];
      expect(rows.some((i) => i.barcode === `ALW1-46-${stamp}`)).toBe(true);
      expect(rows.every((i) => !i.barcode.includes(SCHOOL_A) && !i.barcode.includes(SCHOOL_B))).toBe(true);

      expect((await bookItemsRouter.request(`/?schoolId=${SCHOOL_B}`, { method: "GET" })).status).toBe(403);
      expect((await bookItemsRouter.request(`/barcode/ISO-${stamp}-${SCHOOL_B}`, { method: "GET" })).status).toBe(403);
    } finally {
      await db.delete(bookItems).where(eq(bookItems.id, probeId));
    }
  });
});
