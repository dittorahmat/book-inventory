import { db } from "../../db";
import {
  bookItems,
  bookPackages,
  books,
  bookReturns,
  packageItems,
  purchaseOrders,
  schools,
  studentBookOrders,
  students,
  transferShipments,
} from "../../db/schema";
import type {
  DashboardSchoolSummary,
  DashboardSummaryPayload,
  DashboardTitleStock,
  DashboardPackageStock,
} from "../../lib/dashboard-types";

import {
  AccessHttpError,
  resolveLocationScope,
  type StaffRole,
} from "./access-scope";

export type { StaffRole };

export interface DashboardActor {
  role: StaffRole;
  schoolId: string | null;
}

export class DashboardHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Pure scope resolution so branch isolation is unit-testable without a session. */
export function resolveScope(
  actor: DashboardActor | null,
  requestedSchoolId: string | undefined,
  allSchoolIds: string[],
): string[] {
  try {
    return resolveLocationScope(
      actor,
      requestedSchoolId,
      allSchoolIds.map((id) => ({ id })),
    );
  } catch (err) {
    if (err instanceof AccessHttpError) {
      throw new DashboardHttpError(err.status, err.message);
    }
    throw err;
  }
}

type SchoolRow = typeof schools.$inferSelect;
type BookItemRow = typeof bookItems.$inferSelect;
type PackageItemRow = typeof packageItems.$inferSelect;
type BookPackageRow = typeof bookPackages.$inferSelect;
type StudentRow = typeof students.$inferSelect;
type OrderRow = typeof studentBookOrders.$inferSelect;
type ReturnRow = typeof bookReturns.$inferSelect;
type ShipmentRow = typeof transferShipments.$inferSelect;
type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;

type BookRow = typeof books.$inferSelect;

interface DashboardRows {
  itemRows: BookItemRow[];
  pkgRows: PackageItemRow[];
  pkgDefs: BookPackageRow[];
  bookRows: BookRow[];
  studentRows: StudentRow[];
  orderRows: OrderRow[];
  returnRows: ReturnRow[];
  shipmentRows: ShipmentRow[];
  poRows: PurchaseOrderRow[];
}

/**
 * Ambil semua tabel ringkasan SEKALI untuk seluruh sekolah.
 * Sebelumnya tiap sekolah memicu ~10 full-table scan berurutan
 * (180 sekolah di production = ~1800 query -> Worker kehabisan
 * CPU time dan jatuh ke 500 generik). Sekarang agregasi per
 * sekolah dikerjakan in-memory dari hasil fetch tunggal ini.
 */
async function fetchDashboardRows(database: typeof db): Promise<DashboardRows> {
  const [itemRows, pkgRows, pkgDefs, bookRows, studentRows, orderRows, returnRows, shipmentRows, poRows] =
    await Promise.all([
      database.select().from(bookItems) as Promise<BookItemRow[]>,
      database.select().from(packageItems) as Promise<PackageItemRow[]>,
      database.select().from(bookPackages) as Promise<BookPackageRow[]>,
      database.select().from(books) as Promise<BookRow[]>,
      database.select().from(students) as Promise<StudentRow[]>,
      database.select().from(studentBookOrders) as Promise<OrderRow[]>,
      database.select().from(bookReturns) as Promise<ReturnRow[]>,
      database.select().from(transferShipments) as Promise<ShipmentRow[]>,
      database.select().from(purchaseOrders) as Promise<PurchaseOrderRow[]>,
    ]);
  return { itemRows, pkgRows, pkgDefs, bookRows, studentRows, orderRows, returnRows, shipmentRows, poRows };
}

function isKnownCondition(value: string): value is keyof { new: number; good: number; fair: number; damaged: number } {
  return value === "new" || value === "good" || value === "fair" || value === "damaged";
}

function buildSchoolSummary(school: SchoolRow, rows: DashboardRows): DashboardSchoolSummary {
  const schoolId = school.id;
  const { itemRows, pkgRows, pkgDefs, bookRows, studentRows, orderRows, returnRows, shipmentRows, poRows } = rows;
  const items = itemRows.filter((r) => r.currentSchoolId === schoolId);
  const pkgs = pkgRows.filter((r) => r.currentSchoolId === schoolId);
  const pkgTier = new Map(pkgDefs.map((p) => [p.id, p]));
  const schoolStudents = studentRows.filter((r) => r.schoolId === schoolId);
  const orders = orderRows.filter((r) => r.schoolId === schoolId);
  const studentIds = new Set(schoolStudents.map((s) => s.id));
  const returns = returnRows.filter((r) => studentIds.has(r.studentId));
  const shipments = shipmentRows.filter((r) => r.fromSchoolId === schoolId || r.toSchoolId === schoolId);
  const pos = poRows.filter((r) => r.targetSchoolId === schoolId);

  const byCondition = { new: 0, good: 0, fair: 0, damaged: 0 };
  let inTransit = 0;
  let lost = 0;
  let damaged = 0;
  for (const it of items) {
    if (it.status === "in_stock") {
      if (isKnownCondition(it.condition)) byCondition[it.condition] += 1;
      if (it.condition === "damaged") damaged += 1;
    }
    if (it.status === "in_transit") inTransit += 1;
    if (it.status === "lost") lost += 1;
  }

  const readyPackages = pkgs.filter((p) => p.status === "in_stock").length;

  // Ringkasan per judul & per jenis paket, tanpa identitas fisik (spec: inventory-summary).
  const bookTitle = new Map(bookRows.map((b) => [b.id, b.title]));
  const titleMap = new Map<string, DashboardTitleStock>();
  for (const it of items) {
    let entry = titleMap.get(it.bookId);
    if (!entry) {
      entry = {
        bookId: it.bookId,
        title: bookTitle.get(it.bookId) ?? it.bookId,
        totalQty: 0,
        availableQty: 0,
        inTransitQty: 0,
        byCondition: { new: 0, good: 0, fair: 0, damaged: 0 },
      };
      titleMap.set(it.bookId, entry);
    }
    entry.totalQty += 1;
    if (it.status === "in_stock") {
      entry.availableQty += 1;
      if (isKnownCondition(it.condition)) entry.byCondition[it.condition] += 1;
    }
    if (it.status === "in_transit") entry.inTransitQty += 1;
  }
  const byTitle = [...titleMap.values()].sort((a, b) => b.totalQty - a.totalQty);

  const packageMap = new Map<string, DashboardPackageStock>();
  for (const p of pkgs) {
    const def = pkgTier.get(p.packageId);
    let entry = packageMap.get(p.packageId);
    if (!entry) {
      entry = {
        packageId: p.packageId,
        code: def?.code ?? p.packageId,
        name: def?.name ?? p.packageId,
        totalQty: 0,
        readyQty: 0,
      };
      packageMap.set(p.packageId, entry);
    }
    entry.totalQty += 1;
    if (p.status === "in_stock") entry.readyQty += 1;
  }
  const byPackage = [...packageMap.values()].sort((a, b) => b.totalQty - a.totalQty);

  const waitingOrders = orders.filter((o) => o.fulfillmentStatus === "waiting_preparation").length;
  const shortfall = Math.max(0, waitingOrders - readyPackages);

  const paid = orders.filter((o) => o.paymentStatus === "paid").length;
  const openOrders = orders.filter((o) => o.paymentStatus === "unpaid" || o.paymentStatus === "partial");
  const outstandingRp = openOrders.reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0);

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
  for (const p of pkgs) {
    if (p.status !== "in_stock") continue;
    const def = pkgTier.get(p.packageId);
    if (!def) continue;
    const key = `${def.gradeLevel}|${def.curriculumType}`;
    const tier = tiers.get(key) ?? { gradeLevel: def.gradeLevel, curriculumType: def.curriculumType, students: 0, waitingOrders: 0, readyStock: 0 };
    tier.readyStock += 1;
    tiers.set(key, tier);
  }

  return {
    school: { id: school.id, name: school.name, code: school.code, type: school.type },
    stock: {
      looseInStock: items.filter((i) => i.status === "in_stock").length,
      packagesReady: readyPackages,
      byCondition,
      inTransit,
      lost,
      byTitle,
      byPackage,
    },
    coverage: {
      ratio: waitingOrders === 0 ? null : readyPackages / waitingOrders,
      readyPackages,
      waitingOrders,
      shortfall,
    },
    funnel: {
      waiting: waitingOrders,
      ready: orders.filter((o) => o.fulfillmentStatus === "ready_for_pickup").length,
      picked: orders.filter((o) => o.fulfillmentStatus === "picked_up").length,
    },
    payments: {
      paidShare: orders.length === 0 ? 1 : paid / orders.length,
      outstandingRp,
      unpaidCount: openOrders.length,
      scholarshipPending: orders.filter((o) => o.paymentStatus === "scholarship_pending").length,
    },
    attention: {
      damaged,
      lost,
      returnsReported: returns.filter((r) => r.status === "reported").length,
      transfersInTransit: shipments.filter((s) => s.status === "pending_dispatch" || s.status === "in_transit").length,
      poUnreceived: pos.filter((p) => p.status === "ordered" || p.status === "sent" || p.status === "partially_received").length,
    },
    breakdown: [...tiers.values()].map((t) => ({ ...t, shortfall: Math.max(0, t.waitingOrders - t.readyStock) })),
  };
}

export async function getDashboardSummary(
  database: typeof db,
  actor: DashboardActor | null,
  requestedSchoolId: string | undefined,
): Promise<DashboardSummaryPayload> {
  const allSchoolRows: SchoolRow[] = await database.select().from(schools);
  const scope = resolveScope(actor, requestedSchoolId, allSchoolRows.map((s) => s.id));
  const schoolById = new Map(allSchoolRows.map((s) => [s.id, s]));
  // Satu fetch untuk semua sekolah, lalu bangun ringkasan per sekolah
  // secara sinkron (lihat fetchDashboardRows).
  const rows = await fetchDashboardRows(database);
  const summaries: DashboardSchoolSummary[] = [];
  for (const id of scope) {
    const school = schoolById.get(id);
    if (!school) {
      throw new DashboardHttpError(404, "School not found");
    }
    summaries.push(buildSchoolSummary(school, rows));
  }
  return { mode: requestedSchoolId ? "detail" : "comparison", schools: summaries };
}
