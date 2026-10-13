import { and, gte, inArray, lte } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookPackageItems, books, schools, studentBookOrders, studentOrderItems, students } from "../../db/schema";
import { D1_INLIST_CHUNK_SIZE, chunkRows } from "../lib/d1-write";

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

export interface SalesCategoryRow {
  category: string;
  orderCount: number;
  quantity: number;
  revenue: number;
  collected: number;
  outstanding: number;
}

export interface SalesProgramRow {
  program: string;
  curriculumType: string;
  gradeLevel: string;
  orderCount: number;
  revenue: number;
  collected: number;
  outstanding: number;
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
  byCategory: SalesCategoryRow[];
  byProgram: SalesProgramRow[];
}

export interface SalesReportInput {
  database: AppDatabase;
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
  const { database } = input;
  const schoolIds = input.schoolIds;
  const base = and(
    inArray(studentBookOrders.schoolId, schoolIds),
    gte(studentBookOrders.createdAt, input.from),
    lte(studentBookOrders.createdAt, `${input.to}T23:59:59.999Z`)
  );

  const orders: Array<typeof studentBookOrders.$inferSelect> = await database
    .select()
    .from(studentBookOrders)
    .where(base);

  const orderIds = orders.map((o) => o.id);
  const lineRows: Array<typeof studentOrderItems.$inferSelect> =
    orderIds.length > 0
      ? await database.select().from(studentOrderItems).where(inArray(studentOrderItems.orderId, orderIds))
      : [];

  const qtyByOrder = lineRows.reduce((m, line) => m.set(line.orderId, (m.get(line.orderId) ?? 0) + line.quantity), new Map<string, number>());

  const schoolRows: Array<{ id: string; name: string }> = await database
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
  const byCategory = await buildCategoryBreakdown(database, orders, lineRows);
  const byProgram = await buildProgramBreakdown(database, orders);

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
    byCategory,
    byProgram,
  };
}

/**
 * Atribusi omzet per kategori buku (ADR 0005): order satuan via baris
 * `student_order_items` → `books.category`, order paket via BOM
 * (`book_package_items`) proporsional kuantitas; null → "Tanpa Kategori".
 * Semua filter di WHERE SQL + IN-list di-chunk agar D1-safe (§10/§11).
 */
async function buildCategoryBreakdown(
  database: AppDatabase,
  orders: Array<typeof studentBookOrders.$inferSelect>,
  lineRows: Array<typeof studentOrderItems.$inferSelect>
): Promise<SalesCategoryRow[]> {
  if (orders.length === 0) return [];
  const linesByOrder = new Map<string, Array<typeof studentOrderItems.$inferSelect>>();
  for (const line of lineRows) {
    const list = linesByOrder.get(line.orderId) ?? [];
    list.push(line);
    linesByOrder.set(line.orderId, list);
  }
  const packageIds = [...new Set(orders.map((o) => o.packageId).filter((p): p is string => p !== null))];
  const bomRows: Array<typeof bookPackageItems.$inferSelect> =
    packageIds.length > 0
      ? (
          await Promise.all(
            chunkRows(packageIds, D1_INLIST_CHUNK_SIZE).map((chunk) =>
              database.select().from(bookPackageItems).where(inArray(bookPackageItems.packageId, chunk))
            )
          )
        ).flat()
      : [];
  const bomByPackage = new Map<string, Array<typeof bookPackageItems.$inferSelect>>();
  for (const row of bomRows) {
    const list = bomByPackage.get(row.packageId) ?? [];
    list.push(row);
    bomByPackage.set(row.packageId, list);
  }
  const bookIds = [...new Set([...lineRows.map((l) => l.bookId), ...bomRows.map((b) => b.bookId)])];
  const bookRows: Array<Pick<typeof books.$inferSelect, "id" | "category">> =
    bookIds.length > 0
      ? (
          await Promise.all(
            chunkRows(bookIds, D1_INLIST_CHUNK_SIZE).map((chunk) =>
              database
                .select({ id: books.id, category: books.category })
                .from(books)
                .where(inArray(books.id, chunk))
            )
          )
        ).flat()
      : [];
  const categoryOf = new Map(bookRows.map((b) => [b.id, b.category?.trim() ? b.category : "Tanpa Kategori"]));

  const byCategory = new Map<string, SalesCategoryRow & { orderIds: Set<string> }>();
  const accrue = (category: string, orderId: string, qty: number, share: number, order: typeof orders[number]) => {
    const row = byCategory.get(category) ?? { category, orderCount: 0, quantity: 0, revenue: 0, collected: 0, outstanding: 0, orderIds: new Set<string>() };
    row.orderIds.add(orderId);
    row.orderCount = row.orderIds.size;
    row.quantity += qty;
    row.revenue += order.totalAmount * share;
    row.collected += order.paidAmount * share;
    row.outstanding += (order.totalAmount - order.paidAmount) * share;
    byCategory.set(category, row);
  };
  for (const order of orders) {
    if (order.packageId === null) {
      const lines = linesByOrder.get(order.id) ?? [];
      const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
      if (totalQty === 0) continue;
      for (const line of lines) {
        accrue(categoryOf.get(line.bookId) ?? "Tanpa Kategori", order.id, line.quantity, line.quantity / totalQty, order);
      }
    } else {
      const bom = bomByPackage.get(order.packageId) ?? [];
      const totalBom = bom.reduce((s, b) => s + b.quantity, 0);
      if (totalBom === 0) continue;
      for (const item of bom) {
        accrue(categoryOf.get(item.bookId) ?? "Tanpa Kategori", order.id, item.quantity, item.quantity / totalBom, order);
      }
    }
  }
  return [...byCategory.values()]
    .map(({ orderIds: _orderIds, ...r }) => ({ ...r, revenue: Math.round(r.revenue), collected: Math.round(r.collected), outstanding: Math.round(r.outstanding) }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Per Program = curriculumType × gradeLevel dari murid pemilik order.
 * Lookup murid di-chunk per IN-list agar D1-safe; baca boleh paralel.
 */
async function buildProgramBreakdown(
  database: AppDatabase,
  orders: Array<typeof studentBookOrders.$inferSelect>
): Promise<SalesProgramRow[]> {
  if (orders.length === 0) return [];
  const studentIds = [...new Set(orders.map((o) => o.studentId))];
  const rows: Array<Pick<typeof students.$inferSelect, "id" | "curriculumType" | "gradeLevel">> = (
    await Promise.all(
      chunkRows(studentIds, D1_INLIST_CHUNK_SIZE).map((chunk) =>
        database
          .select({ id: students.id, curriculumType: students.curriculumType, gradeLevel: students.gradeLevel })
          .from(students)
          .where(inArray(students.id, chunk))
      )
    )
  ).flat();
  const byStudent = new Map(rows.map((s) => [s.id, s]));
  const byProgram = new Map<string, SalesProgramRow>();
  for (const order of orders) {
    const st = byStudent.get(order.studentId);
    const curriculum = st?.curriculumType ?? "-";
    const grade = st?.gradeLevel ?? "-";
    const program = `${curriculum} · Kelas ${grade}`;
    const row = byProgram.get(program) ?? {
      program, curriculumType: curriculum, gradeLevel: grade,
      orderCount: 0, revenue: 0, collected: 0, outstanding: 0,
    };
    row.orderCount += 1;
    row.revenue += order.totalAmount;
    row.collected += order.paidAmount;
    row.outstanding += order.totalAmount - order.paidAmount;
    byProgram.set(program, row);
  }
  return [...byProgram.values()].sort((a, b) => b.revenue - a.revenue);
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
  return lines.join("\r\n");
}
