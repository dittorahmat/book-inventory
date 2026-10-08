export interface LooseSummaryRow {
  bookId: string;
  title: string;
  isbn: string;
  coverUrl: string | null;
  sellPrice: number;
  totalQty: number;
  availableQty: number;
  inTransitQty: number;
  byCondition: { new: number; good: number; fair: number; damaged: number };
  byStatus: { in_stock: number; in_transit: number; disposed: number; lost: number };
}

export interface PackageSummaryRow {
  packageId: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: string;
  price: number;
  totalQty: number;
  readyQty: number;
  byStatus: { in_stock: number; reserved: number; dispatched: number; delivered: number };
}

export interface StockOverviewPayload {
  schoolId: string;
  looseTitleCount: number;
  looseTotalQty: number;
  looseAvailableQty: number;
  packageTypeCount: number;
  packageTotalQty: number;
  packageReadyQty: number;
  loose: LooseSummaryRow[];
  packages: PackageSummaryRow[];
}

export interface StockPotentialBreakdown {
  bookId: string;
  title: string;
  isbn: string;
  quantityNeeded: number;
  availableLooseStock: number;
  maxBundlesFromComponent: number;
}

export interface StockPotential {
  packageId: string;
  schoolId: string;
  readyBundleCount: number;
  maxPossibleBundles: number;
  looseStockBreakdown: StockPotentialBreakdown[];
}
