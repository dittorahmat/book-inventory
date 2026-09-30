import { describe, expect, it, afterEach } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bookPackages,
  schools,
  studentBookOrders,
  studentOrderItems,
  students,
} from "../../db/schema";
import { auth } from "../auth";
import { salesReportRouter } from "./sales-report";
import { getSalesReport, salesReportToCsv } from "../services/sales-report";

const FROM = "2020-01-01";
const TO = "2099-12-31";

const realGetSession = auth.api.getSession;
function actAs(
  role: "central_admin" | "warehouse_admin" | "school_admin" | null,
  schoolId: string | null = null
) {
  (auth.api as any).getSession = async () =>
    role ? ({ user: { id: "u-sales-test", role, schoolId } } as any) : null;
}
afterEach(() => {
  (auth.api as any).getSession = realGetSession;
});

async function makeSchool(prefix: string) {
  const id = `sch-sales-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await db.insert(schools).values({
    id,
    name: `Sekolah Sales ${prefix}`,
    code: `SLS-${prefix}-${Date.now()}`,
    type: "branch",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

async function makeStudent(schoolId: string, stamp: number) {
  const id = `stu-sales-${stamp}-${Math.floor(Math.random() * 1000)}`;
  await db.insert(students).values({
    id,
    schoolId,
    nis: `NIS-SLS-${stamp}`,
    name: `Murid Sales ${stamp}`,
    gender: "male",
    gradeLevel: "4",
    curriculumType: "international",
    academicYear: "2026/2027",
    parentName: "Orang Tua",
    parentEmail: `s${stamp}@example.com`,
    parentPhone: "081200000000",
    status: "active",
    isScholarship: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

async function makePackage(stamp: number, price: number) {
  const id = `pkg-sales-${stamp}-${Math.floor(Math.random() * 1000)}`;
  await db.insert(bookPackages).values({
    id,
    code: `PKG-SLS-${stamp}`,
    name: `Paket Sales ${stamp}`,
    gradeLevel: "4",
    curriculumType: "international",
    academicYear: "2026/2027",
    price,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

interface SeededOrder {
  orderId: string;
  schoolId: string;
  studentId: string;
  packageId: string | null;
}

async function makeOrder(input: {
  schoolId: string;
  studentId: string;
  packageId: string | null;
  totalAmount: number;
  paidAmount: number;
  orderType?: "regular" | "scholarship";
  looseQty?: number;
}): Promise<SeededOrder> {
  const stamp = Date.now() + Math.floor(Math.random() * 10000);
  const orderId = `ord-sales-${stamp}-${Math.floor(Math.random() * 10000)}`;
  await db.insert(studentBookOrders).values({
    id: orderId,
    orderNumber: `ORD-SLS-${stamp}`,
    studentId: input.studentId,
    schoolId: input.schoolId,
    packageId: input.packageId,
    orderType: input.orderType ?? "regular",
    paymentStatus: input.paidAmount >= input.totalAmount ? "paid" : "partial",
    fulfillmentStatus: "waiting_preparation",
    totalAmount: input.totalAmount,
    paidAmount: input.paidAmount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (input.looseQty) {
    const [book] = await db.query.books.findMany({ limit: 1 });
    if (book) {
      await db.insert(studentOrderItems).values({
        id: `oi-sales-${stamp}`,
        orderId,
        bookId: book.id,
        quantity: input.looseQty,
        unitPriceSnapshot: Math.round(input.totalAmount / input.looseQty),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return { orderId, schoolId: input.schoolId, studentId: input.studentId, packageId: input.packageId };
}

async function cleanupOrders(rows: SeededOrder[]) {
  for (const r of rows) {
    await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, r.orderId));
    await db.delete(studentBookOrders).where(eq(studentBookOrders.id, r.orderId));
    await db.delete(students).where(eq(students.id, r.studentId));
  }
  for (const r of rows) {
    if (r.packageId) await db.delete(bookPackages).where(eq(bookPackages.id, r.packageId));
    await db.delete(schools).where(eq(schools.id, r.schoolId));
  }
}

describe("Rekap penjualan (spec: sales-report)", () => {
  it("menjumlahkan omzet, terkumpul, piutang, dan memisahkan paket vs satuan", async () => {
    const stamp = Date.now();
    const schoolA = await makeSchool("A");
    const pkg = await makePackage(stamp, 1_000_000);
    const studentA = await makeStudent(schoolA, stamp);

    const seeded: SeededOrder[] = [
      // Paket: 2 order, 1 lunas 1 separuh
      await makeOrder({ schoolId: schoolA, studentId: studentA, packageId: pkg, totalAmount: 1_000_000, paidAmount: 1_000_000 }),
      await makeOrder({ schoolId: schoolA, studentId: studentA, packageId: pkg, totalAmount: 800_000, paidAmount: 300_000 }),
      // Satuan: 1 order 3 eksemplar
      await makeOrder({ schoolId: schoolA, studentId: studentA, packageId: null, totalAmount: 150_000, paidAmount: 50_000, looseQty: 3 }),
      // Beasiswa: total 0
      await makeOrder({ schoolId: schoolA, studentId: studentA, packageId: pkg, totalAmount: 0, paidAmount: 0, orderType: "scholarship" }),
    ];

    try {
      const report = await getSalesReport({ from: FROM, to: TO, schoolIds: [schoolA] });

      expect(report.totals.orderCount).toBe(4);
      expect(report.totals.revenue).toBe(1_950_000);
      expect(report.totals.collected).toBe(1_350_000);
      expect(report.totals.outstanding).toBe(600_000);

      expect(report.byChannel.package.orderCount).toBe(3);
      expect(report.byChannel.package.quantity).toBe(3);
      expect(report.byChannel.package.revenue).toBe(1_800_000);

      expect(report.byChannel.loose.orderCount).toBe(1);
      expect(report.byChannel.loose.quantity).toBe(3);
      expect(report.byChannel.loose.revenue).toBe(150_000);

      expect(report.totals.looseOrderCount).toBe(1);
      expect(report.totals.packageOrderCount).toBe(3);
      expect(report.totals.scholarshipOrderCount).toBe(1);
      expect(report.totals.scholarshipRevenue).toBe(0);

      expect(report.bySchool).toHaveLength(1);
      expect(report.bySchool[0].schoolId).toBe(schoolA);
      expect(report.bySchool[0].revenue).toBe(1_950_000);
      expect(report.bySchool[0].looseOrderCount).toBe(1);
    } finally {
      await cleanupOrders(seeded);
    }
  });

  it("mengabaikan order di luar periode", async () => {
    const stamp = Date.now();
    const schoolA = await makeSchool("Periode");
    const studentA = await makeStudent(schoolA, stamp);
    const seeded = [
      await makeOrder({ schoolId: schoolA, studentId: studentA, packageId: null, totalAmount: 100_000, paidAmount: 0 }),
    ];

    try {
      const empty = await getSalesReport({ from: "2020-01-01", to: "2020-12-31", schoolIds: [schoolA] });
      expect(empty.totals.orderCount).toBe(0);
      expect(empty.totals.revenue).toBe(0);
      expect(empty.bySchool).toHaveLength(0);

      const included = await getSalesReport({ from: FROM, to: TO, schoolIds: [schoolA] });
      expect(included.totals.orderCount).toBe(1);
    } finally {
      await cleanupOrders(seeded);
    }
  });

  it("mengunci admin sekolah pada lokasinya dancentral admin bebas memilih", async () => {
    const stamp = Date.now();
    const schoolA = await makeSchool("LockA");
    const schoolB = await makeSchool("LockB");
    const studentA = await makeStudent(schoolA, stamp);
    const studentB = await makeStudent(schoolB, stamp);
    const seeded = [
      await makeOrder({ schoolId: schoolA, studentId: studentA, packageId: null, totalAmount: 500_000, paidAmount: 500_000 }),
      await makeOrder({ schoolId: schoolB, studentId: studentB, packageId: null, totalAmount: 700_000, paidAmount: 100_000 }),
    ];

    try {
      actAs("school_admin", schoolA);
      const scoped = await salesReportRouter.request(`/?from=${FROM}&to=${TO}`);
      expect(scoped.status).toBe(200);
      const scopedJson = await scoped.json();
      expect(scopedJson.data.scopeSchoolIds).toEqual([schoolA]);
      expect(scopedJson.data.totals.revenue).toBe(500_000);
      expect(scopedJson.data.bySchool).toHaveLength(1);

      // Admin sekolah tidak boleh meminta sekolah lain
      const cross = await salesReportRouter.request(`/?from=${FROM}&to=${TO}&schoolId=${schoolB}`);
      expect(cross.status).toBe(403);

      actAs("central_admin");
      const all = await salesReportRouter.request(`/?from=${FROM}&to=${TO}&schoolId=${schoolA}`);
      const allJson = await all.json();
      expect(allJson.data.totals.revenue).toBe(500_000);

      const combined = await getSalesReport({ from: FROM, to: TO, schoolIds: [schoolA, schoolB] });
      expect(combined.totals.revenue).toBe(1_200_000);
      expect(combined.totals.collected).toBe(600_000);
      expect(combined.totals.outstanding).toBe(600_000);
      expect(combined.bySchool).toHaveLength(2);
    } finally {
      await cleanupOrders(seeded);
    }
  });

  it("menolak format periode yang tidak valid", async () => {
    const bad = await salesReportRouter.request("/?from=01-01-2026&to=2026-12-31");
    expect(bad.status).toBe(400);
  });
});

describe("Ekspor CSV (spec: sales-report)", () => {
  it("CSV memuat baris yang sama dengan respons JSON", async () => {
    const stamp = Date.now();
    const schoolA = await makeSchool("Csv");
    const studentA = await makeStudent(schoolA, stamp);
    const pkg = await makePackage(stamp, 600_000);
    const seeded = [
      await makeOrder({ schoolId: schoolA, studentId: studentA, packageId: pkg, totalAmount: 600_000, paidAmount: 600_000 }),
      await makeOrder({ schoolId: schoolA, studentId: studentA, packageId: null, totalAmount: 200_000, paidAmount: 50_000, looseQty: 2 }),
    ];

    try {
      const report = await getSalesReport({ from: FROM, to: TO, schoolIds: [schoolA] });
      const csv = salesReportToCsv(report);
      const lines = csv.split("\r\n");

      expect(lines[0]).toBe(
        "Sekolah,Order Paket,Order Satuan,Order Beasiswa,Total Order,Omzet,Terkumpul,Piutang"
      );
      expect(lines).toHaveLength(report.bySchool.length + 2);

      const totalLine = lines[lines.length - 1];
      expect(totalLine).toContain("TOTAL");
      expect(totalLine).toContain(String(report.totals.revenue));
      expect(totalLine).toContain(String(report.totals.collected));
      expect(totalLine).toContain(String(report.totals.outstanding));

      // Endpoint CSV unwillingkan header unduhan.
      const res = await salesReportRouter.request(`/csv?from=${FROM}&to=${TO}&schoolId=${schoolA}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      expect(res.headers.get("content-disposition")).toContain("attachment");
      const body = await res.text();
      expect(body).toBe(csv);
    } finally {
      await cleanupOrders(seeded);
    }
  });
});
