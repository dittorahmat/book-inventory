import { eq, getTableColumns, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
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
  DashboardSummaryPayload,
  DashboardTotal,
} from "../../../lib/dashboard-types";
import { selectInChunks } from "../../lib/d1-write";

import {
  AccessHttpError,
  resolveLocationScope,
  type AccessActor,
  type StaffRole,
} from "../access-scope";
import {
  buildSchoolSummary,
  newSchoolScopedRows,
  type BookItemRow,
  type BookStockRow,
  type DashboardRows,
  type OrderRow,
  type PackageItemRow,
  type PackageStockRow,
  type PurchaseOrderRow,
  type ReturnRow,
  type SchoolRow,
  type SchoolScopedRows,
  type ShipmentRow,
  type StockAdjustmentRow,
  type StudentRow,
} from "./dashboard-summary-builder";

export type { StaffRole };
export type DashboardActor = AccessActor;
export const DashboardHttpError = AccessHttpError;

export interface SchoolDashboardQuery {
  actor: DashboardActor | null;
  schoolId?: string;
}

/**
 * Ambil baris ringkasan terpartisi scope sekolah di WHERE SQL (§11 anti
 * Pindai Penuh): tabel milik sekolah difilter `school IN scope`, katalog
 * global kecil (paket, buku) tetap penuh. Retur dijangkau lewat join ke
 * murid dalam scope — satu query, bukan IN ribuan studentId.
 * IN-list di-chunk per D1_INLIST_CHUNK_SIZE agar scope besar (ratusan
 * sekolah, termasuk gudang) tak menabrak batas bound-parameter D1 (§10).
 */
async function fetchDashboardRows(database: AppDatabase, scope: string[]): Promise<DashboardRows> {
  const scoped = scope.length > 0 ? scope : ["__no_school__"];
  const [
    itemRows,
    pkgRows,
    bStockRows,
    pStockRows,
    adjRows,
    pkgDefs,
    bookRows,
    studentRows,
    orderRows,
    poRows,
  ] = await Promise.all([
    selectInChunks<BookItemRow>(scoped, (c) => database.select().from(bookItems).where(inArray(bookItems.currentSchoolId, c))),
    selectInChunks<PackageItemRow>(scoped, (c) => database.select().from(packageItems).where(inArray(packageItems.currentSchoolId, c))),
    selectInChunks<BookStockRow>(scoped, (c) => database.select().from(bookStocks).where(inArray(bookStocks.schoolId, c))),
    selectInChunks<PackageStockRow>(scoped, (c) => database.select().from(packageStocks).where(inArray(packageStocks.schoolId, c))),
    selectInChunks<StockAdjustmentRow>(scoped, (c) => database.select().from(stockAdjustments).where(inArray(stockAdjustments.schoolId, c))),
    database.select().from(bookPackages),
    database.select().from(books),
    selectInChunks<StudentRow>(scoped, (c) => database.select().from(students).where(inArray(students.schoolId, c))),
    selectInChunks<OrderRow>(scoped, (c) => database.select().from(studentBookOrders).where(inArray(studentBookOrders.schoolId, c))),
    selectInChunks<PurchaseOrderRow>(scoped, (c) => database.select().from(purchaseOrders).where(inArray(purchaseOrders.targetSchoolId, c))),
  ]);
  // Shipments dipecah dua query (from / to) lalu digabung dedupe by id:
  // satu statement OR dengan dua IN-list menggandakan param (90+90=180)
  // dan D1 menolaknya — itu 500 comparison kemarin (bukti wrangler tail).
  const [shipFrom, shipTo] = await Promise.all([
    selectInChunks<ShipmentRow>(scoped, (c) =>
      database.select().from(transferShipments).where(inArray(transferShipments.fromSchoolId, c))),
    selectInChunks<ShipmentRow>(scoped, (c) =>
      database.select().from(transferShipments).where(inArray(transferShipments.toSchoolId, c))),
  ]);
  const shipmentRows = [...new Map([...shipFrom, ...shipTo].map((s) => [s.id, s])).values()];
  const returnRows = await selectInChunks<ReturnRow>(scoped, (c) =>
    database
      .select({ ...getTableColumns(bookReturns) })
      .from(bookReturns)
      .innerJoin(students, eq(bookReturns.studentId, students.id))
      .where(inArray(students.schoolId, c)),
  );

  // Partisi sekali di seam (bukan saring JS per sekolah per tabel): tiap
  // baris dikelompokkan ke sekolahnya dalam satu lintasan O(total).
  const perSchool = new Map<string, SchoolScopedRows>();
  const scopedFor = (id: string): SchoolScopedRows => {
    const existing = perSchool.get(id);
    if (existing) return existing;
    const fresh = newSchoolScopedRows();
    perSchool.set(id, fresh);
    return fresh;
  };
  for (const r of itemRows) if (r.currentSchoolId) scopedFor(r.currentSchoolId).items.push(r);
  for (const r of pkgRows) if (r.currentSchoolId) scopedFor(r.currentSchoolId).pkgs.push(r);
  for (const r of bStockRows) scopedFor(r.schoolId).bookStocks.push(r);
  for (const r of pStockRows) scopedFor(r.schoolId).packageStocks.push(r);
  for (const r of adjRows) scopedFor(r.schoolId).adjustments.push(r);
  for (const r of studentRows) scopedFor(r.schoolId).students.push(r);
  for (const r of orderRows) scopedFor(r.schoolId).orders.push(r);
  for (const r of shipmentRows) {
    if (r.fromSchoolId) scopedFor(r.fromSchoolId).shipments.push(r);
    if (r.toSchoolId && r.toSchoolId !== r.fromSchoolId) scopedFor(r.toSchoolId).shipments.push(r);
  }
  for (const r of poRows) if (r.targetSchoolId) scopedFor(r.targetSchoolId).pos.push(r);
  const studentSchool = new Map<string, string>(studentRows.map((s: StudentRow) => [s.id, s.schoolId]));
  for (const r of returnRows) {
    const sid = studentSchool.get(r.studentId);
    if (sid) scopedFor(sid).returns.push(r);
  }
  return { pkgDefs, bookRows, perSchool };
}

/** Jumlahkan ringkasan per sekolah menjadi agregat lintas lokasi (include gudang). */
const buildTotal = (summaries: DashboardSchoolSummary[]): DashboardTotal => ({
  schools: summaries.length,
  looseInStock: summaries.reduce((n, s) => n + s.stock.looseInStock, 0),
  packagesReady: summaries.reduce((n, s) => n + s.stock.packagesReady, 0),
  inTransit: summaries.reduce((n, s) => n + s.stock.inTransit, 0),
  lost: summaries.reduce((n, s) => n + s.stock.lost, 0),
  waitingOrders: summaries.reduce((n, s) => n + s.coverage.waitingOrders, 0),
  shortfall: summaries.reduce((n, s) => n + s.coverage.shortfall, 0),
  readyForPickup: summaries.reduce((n, s) => n + s.funnel.ready, 0),
  pickedUp: summaries.reduce((n, s) => n + s.funnel.picked, 0),
  totalOrders: summaries.reduce((n, s) => n + s.payments.totalOrders, 0),
  outstandingRp: summaries.reduce((n, s) => n + s.payments.outstandingRp, 0),
  scholarshipPending: summaries.reduce((n, s) => n + s.payments.scholarshipPending, 0),
});

/** Petakan error baca D1/skema ke 4xx berpesan jelas (§10.4), bukan 500 generik. */
const isDashboardSchemaError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return /D1_ERROR|Failed query|no such (table|column)|SQLITE_|too many (SQL variables|bound parameters)/i.test(msg);
};

/**
 * Deep Domain Service: Mengenkapsulasi pipeline pembacaan terpartisi dan kompilasi
 * ringkasan metrik cabang/gudang tanpa mengekspos tipe data-clump mentah.
 */
export async function getSchoolDashboardSummary(
  database: AppDatabase,
  query: SchoolDashboardQuery
): Promise<DashboardSummaryPayload> {
  const { actor, schoolId: requestedSchoolId } = query;
  try {
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
      summaries.push(buildSchoolSummary(school, rows, rows.perSchool.get(id) ?? newSchoolScopedRows()));
    }
    return { mode: requestedSchoolId ? "detail" : "comparison", schools: summaries, total: buildTotal(summaries) };
  } catch (err) {
    if (err instanceof DashboardHttpError) throw err;
    if (isDashboardSchemaError(err)) {
      throw new DashboardHttpError(400, "Data dashboard tidak tersedia: struktur data belum sinkron. Hubungi admin pusat.");
    }
    throw err;
  }
}

/** Kompatibilitas mundur bagi caller eksisting */
export const getDashboardSummary = (
  database: AppDatabase,
  actor: DashboardActor | null,
  requestedSchoolId?: string
): Promise<DashboardSummaryPayload> => getSchoolDashboardSummary(database, { actor, schoolId: requestedSchoolId });
