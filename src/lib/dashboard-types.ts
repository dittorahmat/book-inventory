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
}

export interface DashboardSummaryResponse {
  success: boolean;
  data?: DashboardSummaryPayload;
  message?: string;
}
