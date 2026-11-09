import type {
  bookItems,
  bookPackages,
  books,
  bookReturns,
  bookStocks,
  packageItems,
  packageStocks,
  purchaseOrders,
  schools,
  stockAdjustments,
  studentBookOrders,
  students,
  transferShipments,
} from "../../../db/schema";
import type {
  DashboardSchoolSummary,
  DashboardAttention,
  DashboardCoverage,
  DashboardFunnel,
  DashboardPackageStock,
  DashboardPayments,
  DashboardStock,
  DashboardTierBreakdown,
  DashboardTitleStock,
} from "../../../lib/dashboard-types";
import {
  isOpenOrder,
  isReadyBundle,
  outstandingOf,
  tallyLoose,
  tallyLooseByKey,
  tallyPackages,
  tallyPackagesByKey,
} from "../stock";

export type SchoolRow = typeof schools.$inferSelect;
export type BookItemRow = typeof bookItems.$inferSelect;
export type PackageItemRow = typeof packageItems.$inferSelect;
export type BookStockRow = typeof bookStocks.$inferSelect;
export type PackageStockRow = typeof packageStocks.$inferSelect;
export type StockAdjustmentRow = typeof stockAdjustments.$inferSelect;
export type BookPackageRow = typeof bookPackages.$inferSelect;
export type StudentRow = typeof students.$inferSelect;
export type OrderRow = typeof studentBookOrders.$inferSelect;
export type ReturnRow = typeof bookReturns.$inferSelect;
export type ShipmentRow = typeof transferShipments.$inferSelect;
export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
export type BookRow = typeof books.$inferSelect;

export interface SchoolScopedRows {
  items: BookItemRow[];
  pkgs: PackageItemRow[];
  bookStocks: BookStockRow[];
  packageStocks: PackageStockRow[];
  adjustments: StockAdjustmentRow[];
  students: StudentRow[];
  orders: OrderRow[];
  returns: ReturnRow[];
  shipments: ShipmentRow[];
  pos: PurchaseOrderRow[];
}

export interface DashboardRows {
  pkgDefs: BookPackageRow[];
  bookRows: BookRow[];
  perSchool: Map<string, SchoolScopedRows>;
}

export const newSchoolScopedRows = (): SchoolScopedRows => ({
  items: [],
  pkgs: [],
  bookStocks: [],
  packageStocks: [],
  adjustments: [],
  students: [],
  orders: [],
  returns: [],
  shipments: [],
  pos: [],
});

export function buildSchoolSummary(school: SchoolRow, rows: DashboardRows, scoped: SchoolScopedRows): DashboardSchoolSummary {
  const { pkgDefs, bookRows } = rows;
  const {
    items,
    pkgs,
    bookStocks: bStocks,
    packageStocks: pStocks,
    adjustments: adjs,
    orders,
    returns,
    shipments,
    pos,
    students: schoolStudents,
  } = scoped;
  const pkgTier = new Map(pkgDefs.map((p) => [p.id, p]));

  // 1. Loose stock: utamakan agregat book_stocks; fallback ke items legacy bila belum ada book_stocks
  const stockTally = tallyLoose(items);
  const hasAggrBookStock = bStocks.length > 0;
  const looseAvailable = hasAggrBookStock
    ? bStocks.reduce((sum, b) => sum + (b.availableQuantity ?? 0), 0)
    : stockTally.availableQty;
  const looseReserved = hasAggrBookStock
    ? bStocks.reduce((sum, b) => sum + (b.reservedQuantity ?? 0), 0)
    : 0;

  const damagedFromAdj = adjs
    .filter((a) => a.reason === "damaged")
    .reduce((sum, a) => sum + Math.abs(a.quantity), 0);

  const damaged = hasAggrBookStock ? damagedFromAdj : stockTally.damagedQty;
  const inTransit = stockTally.inTransitQty;
  const lost = stockTally.lostQty;

  const byCondition = hasAggrBookStock
    ? {
        new: looseAvailable,
        good: looseReserved,
        fair: 0,
        damaged,
      }
    : stockTally.byConditionAvailable;

  // 2. Package stock: utamakan agregat package_stocks; fallback ke pkgs legacy
  const packageTally = tallyPackages(pkgs);
  const hasAggrPackageStock = pStocks.length > 0;
  const readyPackages = hasAggrPackageStock
    ? pStocks.reduce((sum, p) => sum + (p.availableQuantity ?? 0), 0)
    : packageTally.readyQty;

  // Ringkasan per judul & per jenis paket, tanpa identitas fisik (spec: inventory-summary).
  const bookTitle = new Map(bookRows.map((b) => [b.id, b.title]));
  let byTitle: DashboardTitleStock[] = [];

  if (hasAggrBookStock) {
    byTitle = bStocks
      .map((b) => ({
        bookId: b.bookId,
        title: bookTitle.get(b.bookId) ?? b.bookId,
        totalQty: (b.availableQuantity ?? 0) + (b.reservedQuantity ?? 0),
        availableQty: b.availableQuantity ?? 0,
        inTransitQty: 0,
        byCondition: {
          new: b.availableQuantity ?? 0,
          good: b.reservedQuantity ?? 0,
          fair: 0,
          damaged: 0,
        },
      }))
      .sort((a, b) => b.totalQty - a.totalQty);
  } else {
    const titleTallies = tallyLooseByKey(items, (it) => it.bookId);
    byTitle = [...titleTallies.entries()]
      .map(([bookId, tally]) => ({
        bookId,
        title: bookTitle.get(bookId) ?? bookId,
        totalQty: tally.totalQty,
        availableQty: tally.availableQty,
        inTransitQty: tally.inTransitQty,
        byCondition: tally.byConditionAvailable,
      }))
      .sort((a, b) => b.totalQty - a.totalQty);
  }

  let byPackage: DashboardPackageStock[] = [];

  if (hasAggrPackageStock) {
    byPackage = pStocks
      .map((p) => {
        const def = pkgTier.get(p.packageId);
        const total = (p.availableQuantity ?? 0) + (p.reservedQuantity ?? 0);
        return {
          packageId: p.packageId,
          code: def?.code ?? p.packageId,
          name: def?.name ?? p.packageId,
          totalQty: total,
          readyQty: p.availableQuantity ?? 0,
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty);
  } else {
    const packageTallies = tallyPackagesByKey(pkgs, (p) => p.packageId);
    byPackage = [...packageTallies.entries()]
      .map(([packageId, tally]) => {
        const def = pkgTier.get(packageId);
        return {
          packageId,
          code: def?.code ?? packageId,
          name: def?.name ?? packageId,
          totalQty: tally.totalQty,
          readyQty: tally.readyQty,
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty);
  }

  const waitingOrders = orders.filter((o) => o.fulfillmentStatus === "waiting_preparation").length;
  const shortfall = Math.max(0, waitingOrders - readyPackages);

  const paid = orders.filter((o) => o.paymentStatus === "paid").length;
  const partialCount = orders.filter((o) => o.paymentStatus === "partial").length;
  const unpaidOnlyCount = orders.filter((o) => o.paymentStatus === "unpaid").length;
  const openOrders = orders.filter((o) => isOpenOrder(o.paymentStatus));
  const outstandingRp = openOrders.reduce((sum, o) => sum + outstandingOf(o), 0);

  const tiers = new Map<string, { gradeLevel: string; curriculumType: string; students: number; waitingOrders: number; readyStock: number }>();
  for (const s of schoolStudents) {
    const key = `${s.gradeLevel}|${s.curriculumType}`;
    const tier = tiers.get(key) ?? { gradeLevel: s.gradeLevel, curriculumType: s.curriculumType, students: 0, waitingOrders: 0, readyStock: 0 };
    tier.students += 1;
    tiers.set(key, tier);
  }
  const studentTier = new Map(schoolStudents.map((s) => [s.id, `${s.gradeLevel}|${s.curriculumType}`]));
  for (const o of orders) {
    if (o.fulfillmentStatus !== "waiting_preparation") continue;
    const key = studentTier.get(o.studentId);
    if (key) tiers.get(key)!.waitingOrders += 1;
  }
  if (hasAggrPackageStock) {
    for (const p of pStocks) {
      if ((p.availableQuantity ?? 0) <= 0) continue;
      const def = pkgTier.get(p.packageId);
      if (!def) continue;
      const key = `${def.gradeLevel}|${def.curriculumType}`;
      const tier = tiers.get(key) ?? { gradeLevel: def.gradeLevel, curriculumType: def.curriculumType, students: 0, waitingOrders: 0, readyStock: 0 };
      tier.readyStock += p.availableQuantity ?? 0;
      tiers.set(key, tier);
    }
  } else {
    for (const p of pkgs) {
      if (!isReadyBundle(p.status)) continue;
      const def = pkgTier.get(p.packageId);
      if (!def) continue;
      const key = `${def.gradeLevel}|${def.curriculumType}`;
      const tier = tiers.get(key) ?? { gradeLevel: def.gradeLevel, curriculumType: def.curriculumType, students: 0, waitingOrders: 0, readyStock: 0 };
      tier.readyStock += 1;
      tiers.set(key, tier);
    }
  }

  const stock: DashboardStock = {
    looseInStock: looseAvailable,
    packagesReady: readyPackages,
    byCondition,
    inTransit,
    lost,
    byTitle,
    byPackage,
  };

  const coverage: DashboardCoverage = {
    ratio: waitingOrders === 0 ? null : readyPackages / waitingOrders,
    readyPackages,
    waitingOrders,
    shortfall,
  };

  const funnel: DashboardFunnel = {
    waiting: waitingOrders,
    ready: orders.filter((o) => o.fulfillmentStatus === "ready_for_pickup").length,
    picked: orders.filter((o) => o.fulfillmentStatus === "picked_up").length,
  };

  const payments: DashboardPayments = {
    paidShare: orders.length === 0 ? 1 : paid / orders.length,
    outstandingRp,
    unpaidCount: openOrders.length,
    scholarshipPending: orders.filter((o) => o.paymentStatus === "scholarship_pending").length,
    totalOrders: orders.length,
    paidCount: paid,
    partialCount,
    unpaidOnlyCount,
  };

  const attention: DashboardAttention = {
    damaged,
    lost,
    returnsReported: returns.filter((r) => r.status === "reported").length,
    transfersInTransit: shipments.filter((s) => s.status === "pending_dispatch" || s.status === "in_transit").length,
    poUnreceived: pos.filter((p) => p.status === "ordered" || p.status === "sent" || p.status === "partially_received").length,
  };

  const breakdown: DashboardTierBreakdown[] = [...tiers.values()].map((t) => ({
    ...t,
    shortfall: Math.max(0, t.waitingOrders - t.readyStock),
  }));

  return {
    school: { id: school.id, name: school.name, code: school.code, type: school.type },
    stock,
    coverage,
    funnel,
    payments,
    attention,
    breakdown,
  };
}
