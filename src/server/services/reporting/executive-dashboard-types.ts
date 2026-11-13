import type {
  ExecutiveBranchCashBreakdown,
  ExecutiveBranchOrderBreakdown,
  ExecutiveBranchPoBreakdown,
  ExecutiveBranchStockBreakdown,
  ExecutiveBranchStudentBreakdown,
  ExecutiveMetricValue,
} from "../../../lib/dashboard-types";

export interface PeriodMetrics {
  realizedRp: number;
  outstandingRp: number;
  pendingRefundRp: number;
  scholarshipRp: number;
  totalOrders: number;
  gmvRp: number;
  aovRp: number;
  totalStudents: number;
  adoptionRate: number;
  fulfillmentRate: number;
  inboundUnits: number;
  outboundUnits: number;
  adjustmentUnits: number;
  totalValuationRp: number;
  totalPoCount: number;
  poCommitmentRp: number;
  poFulfillmentRate: number;
}

export function computeMetric(current: number, previous: number | null): ExecutiveMetricValue {
  let deltaPercent: number | null = null;
  if (previous !== null && previous > 0) {
    deltaPercent = Math.round(((current - previous) / previous) * 1000) / 10;
  }
  return { current, previous, deltaPercent };
}

export function initSchoolMaps(schools: Array<{ id: string; name: string; code: string }>) {
  const cashMap = new Map<string, ExecutiveBranchCashBreakdown>();
  const orderMap = new Map<string, ExecutiveBranchOrderBreakdown>();
  const studentMap = new Map<string, ExecutiveBranchStudentBreakdown>();
  const stockMap = new Map<string, ExecutiveBranchStockBreakdown>();
  const poMap = new Map<string, ExecutiveBranchPoBreakdown>();

  for (const sch of schools) {
    cashMap.set(sch.id, {
      schoolId: sch.id,
      schoolName: sch.name,
      schoolCode: sch.code,
      realizedRp: 0,
      outstandingRp: 0,
      pendingRefundRp: 0,
      scholarshipRp: 0,
      paidCount: 0,
      unpaidCount: 0,
    });
    orderMap.set(sch.id, {
      schoolId: sch.id,
      schoolName: sch.name,
      schoolCode: sch.code,
      orderCount: 0,
      gmvRp: 0,
      aovRp: 0,
      packageCount: 0,
      looseCount: 0,
      uniformCount: 0,
      fulfilledCount: 0,
      waitingCount: 0,
    });
    studentMap.set(sch.id, {
      schoolId: sch.id,
      schoolName: sch.name,
      schoolCode: sch.code,
      totalStudents: 0,
      orderedStudents: 0,
      adoptionRate: 0,
      fulfilledStudents: 0,
      byGrade: [],
      byRombel: [],
    });
    stockMap.set(sch.id, {
      schoolId: sch.id,
      schoolName: sch.name,
      schoolCode: sch.code,
      inboundUnits: 0,
      outboundUnits: 0,
      adjustmentUnits: 0,
      valuationRp: 0,
      looseStock: 0,
      packageStock: 0,
    });
    poMap.set(sch.id, {
      schoolId: sch.id,
      schoolName: sch.name,
      schoolCode: sch.code,
      poCount: 0,
      commitmentRp: 0,
      fulfilledUnits: 0,
      totalUnits: 0,
      fulfillmentRate: 0,
    });
  }

  return { cashMap, orderMap, studentMap, stockMap, poMap };
}
