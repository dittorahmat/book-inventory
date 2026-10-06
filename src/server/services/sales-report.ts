import { and, gte, inArray, lte } from "drizzle-orm";
import { db } from "../../db";
import { schools, studentBookOrders, studentOrderItems } from "../../db/schema";

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
  };
  byChannel: {
    package: SalesChannelBreakdown;
    loose: SalesChannelBreakdown;
  };
  bySchool: SalesSchoolRow[];
}

export interface SalesReportInput {
  from: string;
  to: string;
  schoolIds: string[];
}

const emptyChannel = (): SalesChannelBreakdown => ({ orderCount: 0, quantity: 0, revenue: 0, collected: 0, outstanding: 0 });

/**
 * Rekap penjualan dari `student_book_orders` + `student_order_items`
 * (design D8). Order tanpa `packageId` diperlakukan sebagai order satuan.
 */
export async function getSalesReport(input: SalesReportInput): Promise<SalesReport> {
  const schoolIds = input.schoolIds;
  const base = and(
    inArray(studentBookOrders.schoolId, schoolIds),
    gte(studentBookOrders.createdAt, input.from),
    lte(studentBookOrders.createdAt, `${input.to}T23:59:59.999Z`)
  );

  const orders: Array<typeof studentBookOrders.$inferSelect> = await db
    .select()
    .from(studentBookOrders)
    .where(base);

  const orderIds = orders.map((o) => o.id);
  const lineRows: Array<typeof studentOrderItems.$inferSelect> =
    orderIds.length > 0
      ? await db.select().from(studentOrderItems).where(inArray(studentOrderItems.orderId, orderIds))
      : [];

  const qtyByOrder = lineRows.reduce((m, line) => m.set(line.orderId, (m.get(line.orderId) ?? 0) + line.quantity), new Map<string, number>());

  const schoolRows: Array<{ id: string; name: string }> = await db
    .select({ id: schools.id, name: schools.name })
    .from(schools);
  const schoolName = new Map(schoolRows.map((s) => [s.id, s.name]));

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
    },
    byChannel: { package: packageChannel, loose: looseChannel },
    bySchool,
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
  const rupiah = (n: number) => String(Math.round(n));

  const rows: string[][] = report.bySchool.map((r) => [
    r.schoolName,
    String(r.packageOrderCount),
    String(r.looseOrderCount),
    String(r.scholarshipOrderCount),
    String(r.orderCount),
    rupiah(r.revenue),
    rupiah(r.collected),
    rupiah(r.outstanding),
  ]);

  rows.push([
    "TOTAL",
    String(report.totals.packageOrderCount),
    String(report.totals.looseOrderCount),
    String(report.totals.scholarshipOrderCount),
    String(report.totals.orderCount),
    rupiah(report.totals.revenue),
    rupiah(report.totals.collected),
    rupiah(report.totals.outstanding),
  ]);

  const escape = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
}
