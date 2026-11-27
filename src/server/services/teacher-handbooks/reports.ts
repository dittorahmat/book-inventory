import { and, eq, ne, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  bookPackageItems,
  studentBookOrders,
  studentOrderItems,
  teacherHandbookAllocations,
  teacherHandbookOrders,
} from "../../../db/schema";

export async function getTeacherHandbookSummary(db: AppDatabase, schoolId?: string) {
  const cond = schoolId
    ? and(eq(teacherHandbookOrders.schoolId, schoolId), ne(teacherHandbookOrders.status, "cancelled"))
    : ne(teacherHandbookOrders.status, "cancelled");

  const [agg] = await db
    .select({
      totalOrders: sql<number>`count(*)`,
      totalSettlementAmount: sql<number>`coalesce(sum(${teacherHandbookOrders.settlementAmount}), 0)`,
      totalPaidAmount: sql<number>`coalesce(sum(${teacherHandbookOrders.paidAmount}), 0)`,
      unpaidCount: sql<number>`coalesce(sum(case when ${teacherHandbookOrders.settlementStatus} = 'unpaid' then 1 else 0 end), 0)`,
      partialCount: sql<number>`coalesce(sum(case when ${teacherHandbookOrders.settlementStatus} = 'partial' then 1 else 0 end), 0)`,
      paidCount: sql<number>`coalesce(sum(case when ${teacherHandbookOrders.settlementStatus} = 'paid' then 1 else 0 end), 0)`,
    })
    .from(teacherHandbookOrders)
    .where(cond);

  const [dist] = await db
    .select({
      totalOrderedQty: sql<number>`coalesce(sum(${teacherHandbookAllocations.quantity}), 0)`,
      totalDeliveredQty: sql<number>`coalesce(sum(${teacherHandbookAllocations.deliveredQuantity}), 0)`,
      totalHandedOverQty: sql<number>`coalesce(sum(${teacherHandbookAllocations.handedOverQuantity}), 0)`,
    })
    .from(teacherHandbookAllocations)
    .innerJoin(teacherHandbookOrders, eq(teacherHandbookAllocations.orderId, teacherHandbookOrders.id))
    .where(cond);

  return {
    totalOrders: Number(agg?.totalOrders ?? 0),
    totalSettlementAmount: Number(agg?.totalSettlementAmount ?? 0),
    totalPaidAmount: Number(agg?.totalPaidAmount ?? 0),
    unpaidCount: Number(agg?.unpaidCount ?? 0),
    partialCount: Number(agg?.partialCount ?? 0),
    paidCount: Number(agg?.paidCount ?? 0),
    totalOrderedQty: Number(dist?.totalOrderedQty ?? 0),
    totalDeliveredQty: Number(dist?.totalDeliveredQty ?? 0),
    totalHandedOverQty: Number(dist?.totalHandedOverQty ?? 0),
  };
}

export async function getBranchStudentDemand(db: AppDatabase, schoolId: string) {
  const activeCond = and(
    eq(studentBookOrders.schoolId, schoolId),
    ne(studentBookOrders.fulfillmentStatus, "superseded"),
    ne(studentBookOrders.fulfillmentStatus, "picked_up")
  );

  const [looseRows, pkgRows] = await Promise.all([
    db
      .select({
        bookId: studentOrderItems.bookId,
        qty: sql<number>`coalesce(sum(${studentOrderItems.quantity}), 0)`,
      })
      .from(studentOrderItems)
      .innerJoin(studentBookOrders, eq(studentOrderItems.orderId, studentBookOrders.id))
      .where(activeCond)
      .groupBy(studentOrderItems.bookId)
      .limit(200),
    db
      .select({
        bookId: bookPackageItems.bookId,
        qty: sql<number>`coalesce(sum(${bookPackageItems.quantity}), 0)`,
      })
      .from(studentBookOrders)
      .innerJoin(bookPackageItems, eq(studentBookOrders.packageId, bookPackageItems.packageId))
      .where(activeCond)
      .groupBy(bookPackageItems.bookId)
      .limit(200),
  ]);

  const byBook = new Map<string, number>();
  for (const r of [...looseRows, ...pkgRows]) {
    byBook.set(r.bookId, (byBook.get(r.bookId) ?? 0) + Number(r.qty ?? 0));
  }
  return Array.from(byBook.entries()).map(([bookId, estimatedStudents]) => ({
    bookId,
    estimatedStudents,
  }));
}
