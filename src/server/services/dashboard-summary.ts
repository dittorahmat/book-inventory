import { eq, getTableColumns, inArray, or } from "drizzle-orm";
import type { AppDatabase } from "../../db";
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
  type AccessActor,
  type StaffRole,
} from "./access-scope";
import {
  isOpenOrder,
  isReadyBundle,
  outstandingOf,
} from "./stock-buckets";
import {
  addLoose,
  addPackage,
  newLooseTally,
  newPackageTally,
  tallyLoose,
  tallyPackages,
  type LooseTally,
  type PackageTally,
} from "./stock-kernel";

export type { StaffRole };
export type DashboardActor = AccessActor;
export const DashboardHttpError = AccessHttpError;

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
 * Ambil baris ringkasan terpartisi scope sekolah di WHERE SQL (§11 anti
 * Pindai Penuh): tabel milik sekolah difilter `school IN scope`, katalog
 * global kecil (paket, buku) tetap penuh. Retur dijangkau lewat join ke
 * murid dalam scope — satu query, bukan IN ribuan studentId.
 */
async function fetchDashboardRows(database: AppDatabase, scope: string[]): Promise<DashboardRows> {
  const scoped = scope.length > 0 ? scope : ["__no_school__"];
  const [itemRows, pkgRows, pkgDefs, bookRows, studentRows, orderRows, shipmentRows, poRows] = await Promise.all([
    database.select().from(bookItems).where(inArray(bookItems.currentSchoolId, scoped)),
    database.select().from(packageItems).where(inArray(packageItems.currentSchoolId, scoped)),
    database.select().from(bookPackages),
    database.select().from(books),
    database.select().from(students).where(inArray(students.schoolId, scoped)),
    database.select().from(studentBookOrders).where(inArray(studentBookOrders.schoolId, scoped)),
    database
      .select()
      .from(transferShipments)
      .where(or(inArray(transferShipments.fromSchoolId, scoped), inArray(transferShipments.toSchoolId, scoped))),
    database.select().from(purchaseOrders).where(inArray(purchaseOrders.targetSchoolId, scoped)),
  ]);
  const returnRows: ReturnRow[] = await database
    .select({ ...getTableColumns(bookReturns) })
    .from(bookReturns)
    .innerJoin(students, eq(bookReturns.studentId, students.id))
    .where(inArray(students.schoolId, scoped));
  return { itemRows, pkgRows, pkgDefs, bookRows, studentRows, orderRows, returnRows, shipmentRows, poRows };
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

  const stockTally = tallyLoose(items);
  const byCondition = stockTally.byConditionAvailable;
  const inTransit = stockTally.inTransitQty;
  const lost = stockTally.lostQty;
  const damaged = stockTally.damagedQty;

  const packageTally = tallyPackages(pkgs);
  const readyPackages = packageTally.readyQty;

  // Ringkasan per judul & per jenis paket, tanpa identitas fisik (spec: inventory-summary).
  const bookTitle = new Map(bookRows.map((b) => [b.id, b.title]));
  const titleMap = new Map<string, { entry: DashboardTitleStock; tally: LooseTally }>();
  for (const it of items) {
    let slot = titleMap.get(it.bookId);
    if (!slot) {
      slot = {
        entry: {
          bookId: it.bookId,
          title: bookTitle.get(it.bookId) ?? it.bookId,
          totalQty: 0,
          availableQty: 0,
          inTransitQty: 0,
          byCondition: { new: 0, good: 0, fair: 0, damaged: 0 },
        },
        tally: newLooseTally(),
      };
      titleMap.set(it.bookId, slot);
    }
    addLoose(slot.tally, it);
    slot.entry.totalQty = slot.tally.totalQty;
    slot.entry.availableQty = slot.tally.availableQty;
    slot.entry.inTransitQty = slot.tally.inTransitQty;
    slot.entry.byCondition = slot.tally.byConditionAvailable;
  }
  const byTitle = [...titleMap.values()].map((s) => s.entry).sort((a, b) => b.totalQty - a.totalQty);

  const packageMap = new Map<string, { entry: DashboardPackageStock; tally: PackageTally }>();
  for (const p of pkgs) {
    const def = pkgTier.get(p.packageId);
    let slot = packageMap.get(p.packageId);
    if (!slot) {
      slot = {
        entry: {
          packageId: p.packageId,
          code: def?.code ?? p.packageId,
          name: def?.name ?? p.packageId,
          totalQty: 0,
          readyQty: 0,
        },
        tally: newPackageTally(),
      };
      packageMap.set(p.packageId, slot);
    }
    addPackage(slot.tally, p);
    slot.entry.totalQty = slot.tally.totalQty;
    slot.entry.readyQty = slot.tally.readyQty;
  }
  const byPackage = [...packageMap.values()].map((s) => s.entry).sort((a, b) => b.totalQty - a.totalQty);

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
  for (const p of pkgs) {
    if (!isReadyBundle(p.status)) continue;
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
      looseInStock: stockTally.availableQty,
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
      totalOrders: orders.length,
      paidCount: paid,
      partialCount,
      unpaidOnlyCount,
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
  database: AppDatabase,
  actor: DashboardActor | null,
  requestedSchoolId: string | undefined,
): Promise<DashboardSummaryPayload> {
  const allSchoolRows: SchoolRow[] = await database.select().from(schools);
  const scope = resolveLocationScope(actor, requestedSchoolId, allSchoolRows.map((s) => ({ id: s.id })));
  const schoolById = new Map(allSchoolRows.map((s) => [s.id, s]));
  // Satu fetch terpartisi untuk sekolah dalam scope, lalu bangun ringkasan
  // per sekolah secara sinkron (lihat fetchDashboardRows).
  const rows = await fetchDashboardRows(database, scope);
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
