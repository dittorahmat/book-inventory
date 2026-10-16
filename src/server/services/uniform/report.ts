import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  schools,
  students,
  uniformOrders,
  uniformOrderItems,
  uniformPackageBom,
  uniformVariants,
} from "../../../db/schema";
import { gradeToJenjang, type UniformJenjang } from "../../../lib/uniform-types";
import { chunkRows, D1_INLIST_CHUNK_SIZE } from "../../lib/d1-write";

export interface UniformSalesRow {
  schoolId: string;
  schoolName: string;
  jenjang: UniformJenjang;
  size: string;
  orderCount: number;
  studentCount: number;
  quantity: number;
  revenue: number;
}

export interface UniformSalesReport {
  period: { from: string; to: string };
  scopeSchoolIds: string[];
  totals: { orderCount: number; studentCount: number; quantity: number; revenue: number };
  rows: UniformSalesRow[];
}

export interface UniformSalesInput {
  database: AppDatabase;
  from: string;
  to: string;
  schoolIds: string[];
  jenjang?: string;
  size?: string;
  gender?: string;
  paymentStatus?: string;
  shipmentStatus?: string;
}

type OrderRow = typeof uniformOrders.$inferSelect;
type ItemRow = typeof uniformOrderItems.$inferSelect;

const selectInChunks = async <T>(ids: string[], run: (chunk: string[]) => Promise<T[]>): Promise<T[]> =>
  ids.length === 0
    ? []
    : (await Promise.all(chunkRows(ids, D1_INLIST_CHUNK_SIZE).map((chunk) => run(chunk)))).flat();

/**
 * Rekap penjualan seragam terpisah dari buku: dimensi sekolah × jenjang
 * (turunan gradeLevel) × ukuran; metrik order + murid unik + qty + omzet.
 * Baris paket diurai via BOM (kain → "—", olahraga → size ter-resolve);
 * omzet paket dibagi proporsional kuantitas seperti ADR-0005.
 * Filter sekolah + periode di WHERE SQL; IN-list di-chunk (§10/§11).
 */
export async function getUniformSalesReport(input: UniformSalesInput): Promise<UniformSalesReport> {
  const { database } = input;
  const payFilter =
    input.paymentStatus && ["unpaid", "partial", "paid", "scholarship_pending"].includes(input.paymentStatus)
      ? (input.paymentStatus as OrderRow["paymentStatus"])
      : null;
  const shipFilter =
    input.shipmentStatus === "belum_dikirim" || input.shipmentStatus === "sudah_dikirim" ? input.shipmentStatus : null;
  const orders: OrderRow[] = (
    await Promise.all(
      chunkRows(input.schoolIds, D1_INLIST_CHUNK_SIZE).map((chunk) => {
        const conds = [inArray(uniformOrders.schoolId, chunk), gte(uniformOrders.createdAt, input.from), lte(uniformOrders.createdAt, `${input.to}T23:59:59.999Z`)];
        if (payFilter) conds.push(eq(uniformOrders.paymentStatus, payFilter));
        if (shipFilter) conds.push(eq(uniformOrders.shipmentStatus, shipFilter));
        return database
          .select()
          .from(uniformOrders)
          .where(and(...conds));
      })
    )
  ).flat();
  const orderIds = orders.map((o) => o.id);
  const items: ItemRow[] = await selectInChunks(orderIds, (chunk) =>
    database.select().from(uniformOrderItems).where(inArray(uniformOrderItems.orderId, chunk))
  );
  const studentIds = [...new Set(orders.map((o) => o.studentId))];
  const studentRows: Array<{ id: string; gradeLevel: string; gender: string | null }> = await selectInChunks(studentIds, (chunk) =>
    database.select({ id: students.id, gradeLevel: students.gradeLevel, gender: students.gender }).from(students).where(inArray(students.id, chunk))
  );
  const genderByStudent = new Map(studentRows.map((s) => [s.id, s.gender]));
  const inGender = (order: OrderRow): boolean =>
    !input.gender || (input.gender === "female" ? genderByStudent.get(order.studentId) === "female" : genderByStudent.get(order.studentId) !== "female");
  const scopedOrders = orders.filter(inGender);
  const scopedIds = new Set(scopedOrders.map((o) => o.id));
  const scopedItems = items.filter((i) => scopedIds.has(i.orderId));
  const jenjangByStudent = new Map(studentRows.map((s) => [s.id, gradeToJenjang(s.gradeLevel)]));
  const packageIds = [...new Set(items.filter((i) => i.packageId).map((i) => i.packageId as string))];
  const bom: Array<typeof uniformPackageBom.$inferSelect> = await selectInChunks(packageIds, (chunk) =>
    database.select().from(uniformPackageBom).where(inArray(uniformPackageBom.packageId, chunk))
  );
  const bomVariantIds = [...new Set([...items.filter((i) => i.variantId).map((i) => i.variantId as string), ...bom.map((b) => b.variantId)])];
  const variantRows: Array<Pick<typeof uniformVariants.$inferSelect, "id" | "kind">> = await selectInChunks(
    bomVariantIds,
    (chunk) => database.select({ id: uniformVariants.id, kind: uniformVariants.kind }).from(uniformVariants).where(inArray(uniformVariants.id, chunk))
  );
  const kindByVariant = new Map(variantRows.map((v) => [v.id, v.kind]));
  const schoolRows: Array<{ id: string; name: string }> = await database.select({ id: schools.id, name: schools.name }).from(schools);
  const schoolName = new Map(schoolRows.map((s) => [s.id, s.name]));

  const bomByPackage = new Map<string, typeof bom>();
  for (const b of bom) bomByPackage.set(b.packageId, [...(bomByPackage.get(b.packageId) ?? []), b]);

  const acc = new Map<string, UniformSalesRow & { orderIds: Set<string>; studentIds: Set<string> }>();
  const accrue = (order: OrderRow, size: string, qty: number, revenue: number) => {
    const jenjang = jenjangByStudent.get(order.studentId) ?? "sd";
    const key = `${order.schoolId}::${jenjang}::${size}`;
    const row = acc.get(key) ?? {
      schoolId: order.schoolId, schoolName: schoolName.get(order.schoolId) ?? order.schoolId,
      jenjang, size, orderCount: 0, studentCount: 0, quantity: 0, revenue: 0,
      orderIds: new Set<string>(), studentIds: new Set<string>(),
    };
    row.orderIds.add(order.id);
    row.studentIds.add(order.studentId);
    row.orderCount = row.orderIds.size;
    row.studentCount = row.studentIds.size;
    row.quantity += qty;
    row.revenue += revenue;
    acc.set(key, row);
  };

  const itemsByOrder = new Map<string, ItemRow[]>();
  for (const item of scopedItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
  for (const order of scopedOrders) {
    for (const item of itemsByOrder.get(order.id) ?? []) {
      if (item.variantId) {
        accrue(order, item.size, item.quantity, item.quantity * item.unitPriceSnapshot);
      } else if (item.packageId) {
        const lines = bomByPackage.get(item.packageId) ?? [];
        const totalUnits = lines.reduce((s, l) => s + l.quantity, 0) || 1;
        for (const line of lines) {
          const size = line.size !== "—" ? line.size : kindByVariant.get(line.variantId) === "olahraga" ? item.size : "—";
          const qty = item.quantity * line.quantity;
          accrue(order, size, qty, (order.totalAmount * qty) / (totalUnits * item.quantity));
        }
      }
    }
  }
  const rows = [...acc.values()]
    .filter((r) => (!input.jenjang || r.jenjang === input.jenjang) && (!input.size || r.size === input.size))
    .map(({ orderIds: _o, studentIds: _s, ...r }) => r)
    .sort((a, b) => b.revenue - a.revenue);
  const allStudents = new Set(scopedOrders.map((o) => o.studentId));
  return {
    period: { from: input.from, to: input.to },
    scopeSchoolIds: input.schoolIds,
    totals: {
      orderCount: scopedOrders.length,
      studentCount: allStudents.size,
      quantity: rows.reduce((s, r) => s + r.quantity, 0),
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
    },
    rows,
  };
}

/** Tahap order seragam: pemesanan → tagihan (invoice terkirim) → konfirmasi → lunas. */
export type UniformOrderStage = "pemesanan" | "tagihan" | "konfirmasi" | "lunas";

export const uniformOrderStage = (o: Pick<OrderRow, "invoiceSentAt" | "paymentStatus">): UniformOrderStage =>
  !o.invoiceSentAt ? "pemesanan" : o.paymentStatus === "paid" ? "lunas" : o.paymentStatus === "partial" ? "konfirmasi" : "tagihan";

export interface UniformExportRow {
  orderId: string;
  orderNumber: string;
  studentName: string;
  nis: string;
  gradeLevel: string;
  jenjang: UniformJenjang;
  gender: string;
  parentPhone: string;
  address: string;
  size: string;
  quantity: number;
  paymentStatus: string;
  shippingCost: number;
  shippingResi: string;
}

/** Baris export packing/ekspedisi: order lunas (default) per sekolah + item. */
export async function fetchUniformExportRows(
  database: AppDatabase,
  schoolId: string,
  paidOnly: boolean
): Promise<UniformExportRow[]> {
  const orders: OrderRow[] = await database
    .select()
    .from(uniformOrders)
    .where(
      paidOnly
        ? and(eq(uniformOrders.schoolId, schoolId), eq(uniformOrders.paymentStatus, "paid"))
        : eq(uniformOrders.schoolId, schoolId)
    );
  if (orders.length === 0) return [];
  const orderIds = orders.map((o) => o.id);
  const items: ItemRow[] = await selectInChunks(orderIds, (chunk) =>
    database.select().from(uniformOrderItems).where(inArray(uniformOrderItems.orderId, chunk))
  );
  const studentIds = [...new Set(orders.map((o) => o.studentId))];
  const studentRows: Array<{ id: string; name: string; nis: string; gradeLevel: string; gender: string | null; parentPhone: string | null }> =
    await selectInChunks(studentIds, (chunk) =>
      database
        .select({ id: students.id, name: students.name, nis: students.nis, gradeLevel: students.gradeLevel, gender: students.gender, parentPhone: students.parentPhone })
        .from(students)
        .where(inArray(students.id, chunk))
    );
  const byStudent = new Map(studentRows.map((s) => [s.id, s]));
  const itemsByOrder = new Map<string, ItemRow[]>();
  for (const item of items) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
  const rows: UniformExportRow[] = [];
  for (const order of orders) {
    const st = byStudent.get(order.studentId);
    for (const item of itemsByOrder.get(order.id) ?? []) {
      rows.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        studentName: st?.name ?? "",
        nis: st?.nis ?? "",
        gradeLevel: st?.gradeLevel ?? "",
        jenjang: gradeToJenjang(st?.gradeLevel ?? ""),
        gender: st?.gender === "female" ? "akhwat" : "ikhwan",
        parentPhone: st?.parentPhone ?? "",
        address: order.homeAddressSnapshot,
        size: item.size,
        quantity: item.quantity,
        paymentStatus: order.paymentStatus,
        shippingCost: order.shippingCost ?? 0,
        shippingResi: order.shippingResi ?? "",
      });
    }
  }
  return rows;
}

const csvCell = (v: string | number): string => `"${String(v).replaceAll('"', '""')}"`;
const toCsv = (header: string[], lines: Array<Array<string | number>>): string =>
  [header, ...lines].map((r) => r.map(csvCell).join(";")).join("\r\n");

/** CSV rekap seragam: sekolah × jenjang × size. */
export const uniformSalesToCsv = (report: UniformSalesReport): string =>
  [
    ["sekolah", "jenjang", "size", "order", "murid", "qty", "omzet"],
    ...report.rows.map((r) => [r.schoolName, r.jenjang, r.size, String(r.orderCount), String(r.studentCount), String(r.quantity), String(Math.round(r.revenue))]),
    ["TOTAL", "", "", String(report.totals.orderCount), String(report.totals.studentCount), String(report.totals.quantity), String(Math.round(report.totals.revenue))],
  ]
    .map((r) => r.map(csvCell).join(";"))
    .join("\r\n");

/** Packing: nama, NIS, kelas, jenjang, size, gender per baris item. */
export const buildPackingCsv = (rows: UniformExportRow[]): string =>
  toCsv(
    ["nama", "nis", "kelas", "jenjang", "size", "gender", "qty", "no_order"],
    rows.map((r) => [r.studentName, r.nis, r.gradeLevel, r.jenjang, r.size, r.gender, r.quantity, r.orderNumber])
  );

/** Ekspedisi: nama, NIS, kontak ortu, alamat per order (satu baris per order). */
export const buildEkspedisiCsv = (rows: UniformExportRow[]): string => {
  const seen = new Map<string, UniformExportRow>();
  for (const r of rows) if (!seen.has(r.orderId)) seen.set(r.orderId, r);
  return toCsv(
    ["nama", "nis", "kontak_ortu", "alamat", "ongkir", "resi", "no_order"],
    [...seen.values()].map((r) => [r.studentName, r.nis, r.parentPhone, r.address, r.shippingCost, r.shippingResi, r.orderNumber])
  );
};
