export interface DashboardSchoolScope {
  id: string;
  name: string;
  code: string;
  type: "main" | "branch" | "warehouse";
}

export interface DashboardTitleStock {
  bookId: string;
  title: string;
  totalQty: number;
  availableQty: number;
  inTransitQty: number;
  byCondition: { new: number; good: number; fair: number; damaged: number };
}

export interface DashboardPackageStock {
  packageId: string;
  code: string;
  name: string;
  totalQty: number;
  readyQty: number;
}

export interface DashboardStock {
  looseInStock: number;
  packagesReady: number;
  byCondition: { new: number; good: number; fair: number; damaged: number };
  inTransit: number;
  lost: number;
  /** Ringkasan per judul (bukan per barcode) sesuai lokasi sekolah. */
  byTitle: DashboardTitleStock[];
  /** Ringkasan per jenis paket (bukan per bundel fisik) sesuai lokasi sekolah. */
  byPackage: DashboardPackageStock[];
}

export interface DashboardCoverage {
  /** readyPackages / waitingOrders; null when waitingOrders is 0 (frontend shows "Siap"). */
  ratio: number | null;
  readyPackages: number;
  waitingOrders: number;
  shortfall: number;
}

export interface DashboardFunnel {
  waiting: number;
  ready: number;
  picked: number;
}

export interface DashboardPayments {
  /** paidOrders / totalOrders, 0..1; 1 when there are no orders. */
  paidShare: number;
  outstandingRp: number;
  unpaidCount: number;
  scholarshipPending: number;
  /** Hitungan per status untuk donat komposisi (paidShare saja tak cukup). */
  totalOrders: number;
  paidCount: number;
  partialCount: number;
  unpaidOnlyCount: number;
}

export interface DashboardAttention {
  damaged: number;
  lost: number;
  returnsReported: number;
  transfersInTransit: number;
  poUnreceived: number;
}

/** Agregat lintas sekolah (include gudang): jumlah langsung dari ringkasan per sekolah. */
export interface DashboardTotal {
  schools: number;
  looseInStock: number;
  packagesReady: number;
  inTransit: number;
  lost: number;
  waitingOrders: number;
  shortfall: number;
  readyForPickup: number;
  pickedUp: number;
  totalOrders: number;
  outstandingRp: number;
  scholarshipPending: number;
}

export interface DashboardTierBreakdown {
  gradeLevel: string;
  curriculumType: string;
  students: number;
  waitingOrders: number;
  readyStock: number;
  shortfall: number;
}

export interface DashboardSchoolSummary {
  school: DashboardSchoolScope;
  stock: DashboardStock;
  coverage: DashboardCoverage;
  funnel: DashboardFunnel;
  payments: DashboardPayments;
  attention: DashboardAttention;
  breakdown: DashboardTierBreakdown[];
}

export interface DashboardSummaryPayload {
  mode: "comparison" | "detail";
  schools: DashboardSchoolSummary[];
  total: DashboardTotal;
}

export interface DashboardSummaryResponse {
  success: boolean;
  data?: DashboardSummaryPayload;
  message?: string;
}

// ==========================================
// Executive / Presdir Dashboard Types
// ==========================================

export interface ExecutiveMetricValue {
  current: number;
  previous: number | null;
  /** Persentase delta: ((current - previous) / previous) * 100. null bila previous null atau 0. */
  deltaPercent: number | null;
}

export interface ExecutiveBranchCashBreakdown {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  realizedRp: number;
  outstandingRp: number;
  pendingRefundRp: number;
  scholarshipRp: number;
  paidCount: number;
  unpaidCount: number;
}

export interface ExecutiveBranchOrderBreakdown {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  orderCount: number;
  gmvRp: number;
  aovRp: number;
  packageCount: number;
  looseCount: number;
  uniformCount: number;
  fulfilledCount: number;
  waitingCount: number;
}

export interface ExecutiveBranchStudentBreakdown {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  totalStudents: number;
  orderedStudents: number;
  adoptionRate: number; // 0..1
  fulfilledStudents: number;
  byGrade: Array<{ grade: string; total: number; ordered: number }>;
}

export interface ExecutiveBranchStockBreakdown {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  inboundUnits: number;
  outboundUnits: number;
  adjustmentUnits: number;
  valuationRp: number;
  looseStock: number;
  packageStock: number;
}

export interface ExecutiveBranchPoBreakdown {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  poCount: number;
  commitmentRp: number;
  fulfilledUnits: number;
  totalUnits: number;
  fulfillmentRate: number; // 0..1
}

export interface ExecutiveDashboardSummary {
  academicYear: string;
  compareAcademicYear: string | null;
  availableAcademicYears: string[];
  kpis: {
    cash: {
      realizedRp: ExecutiveMetricValue;
      outstandingRp: ExecutiveMetricValue;
      pendingRefundRp: ExecutiveMetricValue;
      scholarshipRp: ExecutiveMetricValue;
    };
    orders: {
      totalOrders: ExecutiveMetricValue;
      gmvRp: ExecutiveMetricValue;
      aovRp: ExecutiveMetricValue;
    };
    students: {
      totalStudents: ExecutiveMetricValue;
      adoptionRate: ExecutiveMetricValue; // percentage
      fulfillmentRate: ExecutiveMetricValue;
    };
    stockMovement: {
      inboundUnits: ExecutiveMetricValue;
      outboundUnits: ExecutiveMetricValue;
      adjustmentUnits: ExecutiveMetricValue;
      totalValuationRp: ExecutiveMetricValue;
    };
    po: {
      totalPoCount: ExecutiveMetricValue;
      commitmentRp: ExecutiveMetricValue;
      fulfillmentRate: ExecutiveMetricValue;
    };
  };
  breakdowns: {
    cash: ExecutiveBranchCashBreakdown[];
    orders: ExecutiveBranchOrderBreakdown[];
    students: ExecutiveBranchStudentBreakdown[];
    stock: ExecutiveBranchStockBreakdown[];
    po: ExecutiveBranchPoBreakdown[];
  };
}

export interface ExecutiveDashboardResponse {
  success: boolean;
  data?: ExecutiveDashboardSummary;
  message?: string;
}

