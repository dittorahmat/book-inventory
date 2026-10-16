import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { studentBookOrders, studentOrderItems, students } from "../../../db/schema";
import { D1_INLIST_CHUNK_SIZE, chunkRows } from "../../lib/d1-write";
import { buildCategoryBreakdown, buildProgramBreakdown } from "./sales-breakdown";
import type { SalesCategoryRow, SalesProgramRow } from "./sales-breakdown";
import { buildHandoverSection, countRejectedItems, loadSchoolNames } from "./sales-handover";
import type { SalesHandoverSection } from "./sales-handover";

export interface SalesChannelBreakdown {
  orderCount: number;
  quantity: number;
  revenue: number;
  collected: number;
  outstanding: number;
}

export interface SalesSchoolRow {
  schoolId: string;
  schoolName: string;
  revenue: number;
  collected: number;
  outstanding: number;
  orderCount: number;
  packageOrderCount: number;
  looseOrderCount: number;
  scholarshipOrderCount: number;
}

export interface SalesReport {
  period: { from: string; to: string };
  scopeSchoolIds: string[];
  totals: SalesChannelBreakdown & {
    packageOrderCount: number;
    looseOrderCount: number;
    scholarshipOrderCount: number;
    scholarshipRevenue: number;
    shippingTotal: number;
    invoicedCount: number;
    rejectedItems: number;
  };
  byChannel: {
    package: SalesChannelBreakdown;
    loose: SalesChannelBreakdown;
  };
  bySchool: SalesSchoolRow[];
  byCategory: SalesCategoryRow[];
  byProgram: SalesProgramRow[];
  handover: SalesHandoverSection;
}

export interface SalesReportInput {
  database: AppDatabase;
  from: string;
  to: string;
  schoolIds: string[];
  gradeLevel?: string;
  gender?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
}

const emptyChannel = (): SalesChannelBreakdown => ({ orderCount: 0, quantity: 0, revenue: 0, collected: 0, outstanding: 0 });

/**
 * Rekap penjualan dari `student_book_orders` + `student_order_items`
 * (design D8). Order tanpa `packageId` diperlakukan sebagai order satuan.
 * Filter bayar/serah-terima di WHERE SQL; dimensi murid (kelas/gender)
 * disaring di atas himpunan terpartisi.
 */
export async function getSalesReport(input: SalesReportInput): Promise<SalesReport> {
  const { database } = input;
  const schoolIds = input.schoolIds;
  const orderFilters = [inArray(studentBookOrders.schoolId, schoolIds)];
  if (input.paymentStatus && input.paymentStatus !== "all") {
    orderFilters.push(eq(studentBookOrders.paymentStatus, input.paymentStatus as typeof studentBookOrders.$inferSelect.paymentStatus));
  }
  if (input.fulfillmentStatus && input.fulfillmentStatus !== "all") {
    orderFilters.push(eq(studentBookOrders.fulfillmentStatus, input.fulfillmentStatus as typeof studentBookOrders.$inferSelect.fulfillmentStatus));
  }
  const base = and(
    ...orderFilters,
    gte(studentBookOrders.createdAt, input.from),
    lte(studentBookOrders.createdAt, `${input.to}T23:59:59.999Z`)
  );

  let orders: Array<typeof studentBookOrders.$inferSelect> = await database
    .select()
    .from(studentBookOrders)
    .where(base);

  if (input.gradeLevel || input.gender) {
    const ids = [...new Set(orders.map((o) => o.studentId))];
    const dimRows: Array<Pick<typeof students.$inferSelect, "id" | "gradeLevel" | "gender">> =
      ids.length > 0
        ? (
            await Promise.all(
              chunkRows(ids, D1_INLIST_CHUNK_SIZE).map((chunk) =>
                database
                  .select({ id: students.id, gradeLevel: students.gradeLevel, gender: students.gender })
                  .from(students)
                  .where(inArray(students.id, chunk))
              )
            )
          ).flat()
        : [];
    const dim = new Map(dimRows.map((s) => [s.id, s]));
    orders = orders.filter((o) => {
      const st = dim.get(o.studentId);
      return (!input.gradeLevel || st?.gradeLevel === input.gradeLevel) && (!input.gender || (st?.gender ?? "") === input.gender);
    });
  }

  const orderIds = orders.map((o) => o.id);
  const lineRows: Array<typeof studentOrderItems.$inferSelect> =
    orderIds.length > 0
      ? await database.select().from(studentOrderItems).where(inArray(studentOrderItems.orderId, orderIds))
      : [];

  const qtyByOrder = lineRows.reduce((m, line) => m.set(line.orderId, (m.get(line.orderId) ?? 0) + line.quantity), new Map<string, number>());

  const schoolName = await loadSchoolNames(database);

  const packageChannel = emptyChannel();
  const looseChannel = emptyChannel();
  const bySchoolMap = new Map<string, SalesSchoolRow>();

  for (const order of orders) {
    const isLoose = order.packageId === null;
    const channel = isLoose ? looseChannel : packageChannel;
    const quantity = isLoose ? (qtyByOrder.get(order.id) ?? 0) : 1;
    const outstanding = order.totalAmount - order.paidAmount;

    channel.orderCount += 1;
    channel.quantity += quantity;
    channel.revenue += order.totalAmount;
    channel.collected += order.paidAmount;
    channel.outstanding += outstanding;

    const row = bySchoolMap.get(order.schoolId) ?? (bySchoolMap.set(order.schoolId, {
        schoolId: order.schoolId,
        schoolName: schoolName.get(order.schoolId) ?? order.schoolId,
        revenue: 0,
        collected: 0,
        outstanding: 0,
        orderCount: 0,
        packageOrderCount: 0,
        looseOrderCount: 0,
        scholarshipOrderCount: 0,
      }).get(order.schoolId) as SalesSchoolRow);
    row.revenue += order.totalAmount;
    row.collected += order.paidAmount;
    row.outstanding += outstanding;
    row.orderCount += 1;
    if (isLoose) row.looseOrderCount += 1;
    else row.packageOrderCount += 1;
    if (order.orderType === "scholarship") row.scholarshipOrderCount += 1;
  }

  const packageOrderCount = packageChannel.orderCount;
  const looseOrderCount = looseChannel.orderCount;
  const scholarshipOrders = orders.filter((o) => o.orderType === "scholarship");
  const bySchool = [...bySchoolMap.values()].sort((a, b) => b.revenue - a.revenue);
  const byCategory = await buildCategoryBreakdown(database, orders, lineRows);
  const byProgram = await buildProgramBreakdown(database, orders);
  const shippingTotal = orders.reduce((s, o) => s + (o.shippingCost ?? 0), 0);
  const invoicedCount = orders.filter((o) => o.invoiceSentAt).length;
  const handover = buildHandoverSection(orders, schoolName);
  const rejectedItems = await countRejectedItems(database, schoolIds);

  return {
    period: { from: input.from, to: input.to },
    scopeSchoolIds: schoolIds,
    totals: {
      orderCount: packageChannel.orderCount + looseChannel.orderCount,
      quantity: packageChannel.quantity + looseChannel.quantity,
      revenue: packageChannel.revenue + looseChannel.revenue,
      collected: packageChannel.collected + looseChannel.collected,
      outstanding: packageChannel.outstanding + looseChannel.outstanding,
      packageOrderCount,
      looseOrderCount,
      scholarshipOrderCount: scholarshipOrders.length,
      scholarshipRevenue: scholarshipOrders.reduce((s, o) => s + o.totalAmount, 0),
      shippingTotal,
      invoicedCount,
      rejectedItems,
    },
    byChannel: { package: packageChannel, loose: looseChannel },
    bySchool,
    byCategory,
    byProgram,
    handover,
  };
}

/** Baris CSV dari shape yang sama dengan respons JSON (task 6.2). */
export function salesReportToCsv(report: SalesReport): string {
  const header = [
    "Sekolah",
    "Order Paket",
    "Order Satuan",
    "Order Beasiswa",
    "Total Order",
    "Omzet",
    "Terkumpul",
    "Piutang",
  ];
  const toCsvInt = (n: number) => String(Math.round(n));

  const rows: string[][] = report.bySchool.map((r) => [
    r.schoolName,
    String(r.packageOrderCount),
    String(r.looseOrderCount),
    String(r.scholarshipOrderCount),
    String(r.orderCount),
    toCsvInt(r.revenue),
    toCsvInt(r.collected),
    toCsvInt(r.outstanding),
  ]);

  rows.push([
    "TOTAL",
    String(report.totals.packageOrderCount),
    String(report.totals.looseOrderCount),
    String(report.totals.scholarshipOrderCount),
    String(report.totals.orderCount),
    toCsvInt(report.totals.revenue),
    toCsvInt(report.totals.collected),
    toCsvInt(report.totals.outstanding),
  ]);

  const escape = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  const lines = [header, ...rows].map((r) => r.map(escape).join(","));
  if (report.byCategory.length > 0) {
    lines.push("", ["Kategori", "Order", "Qty", "Omzet", "Terkumpul", "Piutang"].map(escape).join(","));
    for (const cat of report.byCategory) {
      lines.push(
        [cat.category, String(cat.orderCount), String(cat.quantity), toCsvInt(cat.revenue), toCsvInt(cat.collected), toCsvInt(cat.outstanding)]
          .map(escape)
          .join(",")
      );
    }
  }
  if (report.byProgram.length > 0) {
    lines.push("", ["Program", "Order", "Omzet", "Terkumpul", "Piutang"].map(escape).join(","));
    for (const p of report.byProgram) {
      lines.push(
        [p.program, String(p.orderCount), toCsvInt(p.revenue), toCsvInt(p.collected), toCsvInt(p.outstanding)]
          .map(escape)
          .join(",")
      );
    }
  }
  lines.push("", ["Serah-terima (finance)", "Order", "Omzet", "Terkumpul", "Ongkir"].map(escape).join(","));
  lines.push(
    ["AGREGAT", String(report.handover.orderCount), toCsvInt(report.handover.revenue), toCsvInt(report.handover.collected), toCsvInt(report.handover.shippingTotal)]
      .map(escape)
      .join(",")
  );
  for (const h of report.handover.bySchool) {
    lines.push(
      [h.schoolName, String(h.orderCount), toCsvInt(h.revenue), toCsvInt(h.collected), toCsvInt(h.shippingTotal)]
        .map(escape)
        .join(",")
    );
  }
  lines.push("", [`Total ongkir: ${toCsvInt(report.totals.shippingTotal)}`, `Invoice terkirim: ${report.totals.invoicedCount}`, `Eksemplar reject: ${report.totals.rejectedItems}`].map(escape).join(","));
  return lines.join("\r\n");
}
