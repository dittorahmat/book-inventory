import { inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { bookPackageItems, books, students } from "../../../db/schema";
import { D1_INLIST_CHUNK_SIZE, chunkRows } from "../../lib/d1-write";
import type { studentBookOrders, studentOrderItems } from "../../../db/schema";

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

/**
 * Atribusi omzet per kategori buku (ADR 0005): order satuan via baris
 * `student_order_items` → `books.category`, order paket via BOM
 * (`book_package_items`) proporsional kuantitas; null → "Tanpa Kategori".
 * Semua filter di WHERE SQL + IN-list di-chunk agar D1-safe (§10/§11).
 */
export async function buildCategoryBreakdown(
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
export async function buildProgramBreakdown(
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
