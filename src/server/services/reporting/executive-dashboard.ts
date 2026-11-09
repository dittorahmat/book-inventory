import { inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  bookPackages,
  books,
  bookStocks,
  packageStocks,
  purchaseOrders,
  schools,
  stockAdjustments,
  studentBookOrders,
  students,
} from "../../../db/schema";
import type {
  ExecutiveBranchCashBreakdown,
  ExecutiveBranchOrderBreakdown,
  ExecutiveBranchPoBreakdown,
  ExecutiveBranchStockBreakdown,
  ExecutiveBranchStudentBreakdown,
  ExecutiveDashboardSummary,
} from "../../../lib/dashboard-types";
import { outstandingOf } from "../stock/buckets";
import { selectInChunks } from "../../lib/d1-write";
import { AccessHttpError, type AccessActor } from "../access-scope";
import { computeMetric, initSchoolMaps, type PeriodMetrics } from "./executive-dashboard-types";

export class ExecutiveDashboardHttpError extends AccessHttpError {}

export async function getExecutiveDashboardSummary(
  database: AppDatabase,
  actor: AccessActor,
  requestedAcademicYear?: string,
  requestedCompareYear?: string,
): Promise<ExecutiveDashboardSummary> {
  if (actor.role !== "central_admin") {
    throw new ExecutiveDashboardHttpError(403, "Hanya Administrator Pusat yang berwenang mengakses Dashboard Eksekutif.");
  }

  const schoolRows = await database.select().from(schools);
  const schoolIds = schoolRows.map((s) => s.id);
  const scopedSchoolIds = schoolIds.length > 0 ? schoolIds : ["__no_school__"];

  const [studentYearRows, packageYearRows] = await Promise.all([
    database.select({ year: students.academicYear }).from(students),
    database.select({ year: bookPackages.academicYear }).from(bookPackages),
  ]);
  const yearSet = new Set<string>();
  for (const r of studentYearRows) if (r.year) yearSet.add(r.year);
  for (const r of packageYearRows) if (r.year) yearSet.add(r.year);
  if (yearSet.size === 0) yearSet.add("2026/2027");

  const availableAcademicYears = Array.from(yearSet).sort().reverse();
  const academicYear = requestedAcademicYear && availableAcademicYears.includes(requestedAcademicYear)
    ? requestedAcademicYear
    : availableAcademicYears[0] || "2026/2027";

  const compareAcademicYear = requestedCompareYear && availableAcademicYears.includes(requestedCompareYear) && requestedCompareYear !== academicYear
    ? requestedCompareYear
    : null;

  const bookList = await database.select().from(books);
  const bookPriceMap = new Map(bookList.map((b) => [b.id, b.price || 0]));

  async function aggregatePeriod(targetYear: string): Promise<{
    metrics: PeriodMetrics;
    cashBySchool: Map<string, ExecutiveBranchCashBreakdown>;
    ordersBySchool: Map<string, ExecutiveBranchOrderBreakdown>;
    studentsBySchool: Map<string, ExecutiveBranchStudentBreakdown>;
    stockBySchool: Map<string, ExecutiveBranchStockBreakdown>;
    poBySchool: Map<string, ExecutiveBranchPoBreakdown>;
  }> {
    const [periodStudents, periodOrders, periodStocks, periodPackageStocks, periodAdjs, periodPos] = await Promise.all([
      selectInChunks(scopedSchoolIds, (c) => database.select().from(students).where(inArray(students.schoolId, c))),
      selectInChunks(scopedSchoolIds, (c) => database.select().from(studentBookOrders).where(inArray(studentBookOrders.schoolId, c))),
      selectInChunks(scopedSchoolIds, (c) => database.select().from(bookStocks).where(inArray(bookStocks.schoolId, c))),
      selectInChunks(scopedSchoolIds, (c) => database.select().from(packageStocks).where(inArray(packageStocks.schoolId, c))),
      selectInChunks(scopedSchoolIds, (c) => database.select().from(stockAdjustments).where(inArray(stockAdjustments.schoolId, c))),
      selectInChunks(scopedSchoolIds, (c) => database.select().from(purchaseOrders).where(inArray(purchaseOrders.targetSchoolId, c))),
    ]);

    const activeStudents = periodStudents.filter((s) => s.academicYear === targetYear);
    const activeStudentIds = new Set(activeStudents.map((s) => s.id));
    const activeOrders = periodOrders.filter((o) => activeStudentIds.has(o.studentId));

    const { cashMap, orderMap, studentMap, stockMap, poMap } = initSchoolMaps(schoolRows);

    const studentGradeCount = new Map<string, Map<string, { total: number; ordered: number }>>();
    for (const st of activeStudents) {
      const schStudent = studentMap.get(st.schoolId);
      if (schStudent) schStudent.totalStudents += 1;

      if (!studentGradeCount.has(st.schoolId)) studentGradeCount.set(st.schoolId, new Map());
      const gradeMap = studentGradeCount.get(st.schoolId)!;
      const g = st.gradeLevel || "Lainnya";
      const curr = gradeMap.get(g) ?? { total: 0, ordered: 0 };
      curr.total += 1;
      gradeMap.set(g, curr);
    }

    const studentOrderSet = new Set<string>();
    const studentFulfilledSet = new Set<string>();

    for (const ord of activeOrders) {
      studentOrderSet.add(ord.studentId);
      if (ord.fulfillmentStatus === "picked_up") studentFulfilledSet.add(ord.studentId);

      const schOrder = orderMap.get(ord.schoolId);
      const schCash = cashMap.get(ord.schoolId);
      if (schOrder) {
        schOrder.orderCount += 1;
        schOrder.gmvRp += ord.totalAmount || 0;
        if (ord.packageId) schOrder.packageCount += 1;
        else schOrder.looseCount += 1;
        if (ord.fulfillmentStatus === "picked_up") schOrder.fulfilledCount += 1;
        else schOrder.waitingCount += 1;
      }
      if (schCash) {
        schCash.realizedRp += ord.paidAmount || 0;
        schCash.outstandingRp += outstandingOf(ord);
        if (ord.paymentStatus === "paid") schCash.paidCount += 1;
        else schCash.unpaidCount += 1;
      }
    }

    for (const [schId, grMap] of studentGradeCount.entries()) {
      const schStudent = studentMap.get(schId);
      if (schStudent) {
        schStudent.byGrade = Array.from(grMap.entries()).map(([grade, stats]) => ({
          grade,
          total: stats.total,
          ordered: stats.ordered,
        }));
      }
    }
    for (const st of activeStudents) {
      if (studentOrderSet.has(st.id)) {
        const schStudent = studentMap.get(st.schoolId);
        if (schStudent) schStudent.orderedStudents += 1;
      }
      if (studentFulfilledSet.has(st.id)) {
        const schStudent = studentMap.get(st.schoolId);
        if (schStudent) schStudent.fulfilledStudents += 1;
      }
    }
    for (const schStudent of studentMap.values()) {
      schStudent.adoptionRate = schStudent.totalStudents > 0
        ? Math.round((schStudent.orderedStudents / schStudent.totalStudents) * 1000) / 10
        : 0;
    }
    for (const schOrder of orderMap.values()) {
      schOrder.aovRp = schOrder.orderCount > 0 ? Math.round(schOrder.gmvRp / schOrder.orderCount) : 0;
    }

    for (const bs of periodStocks) {
      const schStock = stockMap.get(bs.schoolId);
      if (schStock) {
        const qty = bs.availableQuantity + bs.reservedQuantity;
        schStock.looseStock += qty;
        const price = bookPriceMap.get(bs.bookId) || 0;
        schStock.valuationRp += qty * price;
      }
    }
    for (const ps of periodPackageStocks) {
      const schStock = stockMap.get(ps.schoolId);
      if (schStock) schStock.packageStock += ps.availableQuantity + ps.reservedQuantity;
    }
    for (const adj of periodAdjs) {
      const schStock = stockMap.get(adj.schoolId);
      if (schStock) schStock.adjustmentUnits += Math.abs(adj.quantity);
    }
    for (const po of periodPos) {
      const schPo = poMap.get(po.targetSchoolId);
      if (schPo) {
        schPo.poCount += 1;
        schPo.commitmentRp += po.totalAmount || 0;
      }
    }

    const totalStudents = activeStudents.length;
    const orderedStudents = studentOrderSet.size;
    const fulfilledStudents = studentFulfilledSet.size;
    const adoptionRate = totalStudents > 0 ? Math.round((orderedStudents / totalStudents) * 1000) / 10 : 0;
    const fulfillmentRate = orderedStudents > 0 ? Math.round((fulfilledStudents / orderedStudents) * 1000) / 10 : 0;

    let realizedRp = 0;
    let outstandingRp = 0;
    const totalOrders = activeOrders.length;
    let gmvRp = 0;

    for (const c of cashMap.values()) {
      realizedRp += c.realizedRp;
      outstandingRp += c.outstandingRp;
    }
    for (const o of orderMap.values()) gmvRp += o.gmvRp;
    const aovRp = totalOrders > 0 ? Math.round(gmvRp / totalOrders) : 0;

    let totalValuationRp = 0;
    let adjustmentUnits = 0;
    let inboundUnits = 0;
    let outboundUnits = 0;
    for (const s of stockMap.values()) {
      totalValuationRp += s.valuationRp;
      adjustmentUnits += s.adjustmentUnits;
      inboundUnits += s.inboundUnits;
      outboundUnits += s.outboundUnits;
    }

    let totalPoCount = 0;
    let poCommitmentRp = 0;
    for (const p of poMap.values()) {
      totalPoCount += p.poCount;
      poCommitmentRp += p.commitmentRp;
    }

    return {
      metrics: {
        realizedRp,
        outstandingRp,
        pendingRefundRp: 0,
        scholarshipRp: 0,
        totalOrders,
        gmvRp,
        aovRp,
        totalStudents,
        adoptionRate,
        fulfillmentRate,
        inboundUnits,
        outboundUnits,
        adjustmentUnits,
        totalValuationRp,
        totalPoCount,
        poCommitmentRp,
        poFulfillmentRate: 100,
      },
      cashBySchool: cashMap,
      ordersBySchool: orderMap,
      studentsBySchool: studentMap,
      stockBySchool: stockMap,
      poBySchool: poMap,
    };
  }

  const currentData = await aggregatePeriod(academicYear);
  const prevData = compareAcademicYear ? await aggregatePeriod(compareAcademicYear) : null;
  const curM = currentData.metrics;
  const prvM = prevData ? prevData.metrics : null;

  return {
    academicYear,
    compareAcademicYear,
    availableAcademicYears,
    kpis: {
      cash: {
        realizedRp: computeMetric(curM.realizedRp, prvM?.realizedRp ?? null),
        outstandingRp: computeMetric(curM.outstandingRp, prvM?.outstandingRp ?? null),
        pendingRefundRp: computeMetric(curM.pendingRefundRp, prvM?.pendingRefundRp ?? null),
        scholarshipRp: computeMetric(curM.scholarshipRp, prvM?.scholarshipRp ?? null),
      },
      orders: {
        totalOrders: computeMetric(curM.totalOrders, prvM?.totalOrders ?? null),
        gmvRp: computeMetric(curM.gmvRp, prvM?.gmvRp ?? null),
        aovRp: computeMetric(curM.aovRp, prvM?.aovRp ?? null),
      },
      students: {
        totalStudents: computeMetric(curM.totalStudents, prvM?.totalStudents ?? null),
        adoptionRate: computeMetric(curM.adoptionRate, prvM?.adoptionRate ?? null),
        fulfillmentRate: computeMetric(curM.fulfillmentRate, prvM?.fulfillmentRate ?? null),
      },
      stockMovement: {
        inboundUnits: computeMetric(curM.inboundUnits, prvM?.inboundUnits ?? null),
        outboundUnits: computeMetric(curM.outboundUnits, prvM?.outboundUnits ?? null),
        adjustmentUnits: computeMetric(curM.adjustmentUnits, prvM?.adjustmentUnits ?? null),
        totalValuationRp: computeMetric(curM.totalValuationRp, prvM?.totalValuationRp ?? null),
      },
      po: {
        totalPoCount: computeMetric(curM.totalPoCount, prvM?.totalPoCount ?? null),
        commitmentRp: computeMetric(curM.poCommitmentRp, prvM?.poCommitmentRp ?? null),
        fulfillmentRate: computeMetric(curM.poFulfillmentRate, prvM?.poFulfillmentRate ?? null),
      },
    },
    breakdowns: {
      cash: Array.from(currentData.cashBySchool.values()),
      orders: Array.from(currentData.ordersBySchool.values()),
      students: Array.from(currentData.studentsBySchool.values()),
      stock: Array.from(currentData.stockBySchool.values()),
      po: Array.from(currentData.poBySchool.values()),
    },
  };
}
