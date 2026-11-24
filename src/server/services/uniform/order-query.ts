import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { schools, students, uniformOrders } from "../../../db/schema";
import { AccessHttpError } from "../access-scope";
import { matchAnyLower } from "../../lib/partitioned-search";
import { pendingPaymentCounts } from "../order-payment-review";
import { uniformOrderStage, uniformStageFilter } from "./report";
import { parsePaginationParams } from "../../lib/validators";

/** Baca daftar/scope order seragam — dipisah dari tulis order agar tiap modul < 400 baris. */

export interface UniformOrderListFilters {
  schoolId?: string;
  shipmentStatus?: string;
  paymentStatus?: string;
  stage?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Gerbang scope order seragam: 403 bila order ada di luar penugasan aktor. */
export const assertUniformOrderInScope = async (
  database: AppDatabase,
  scope: string[],
  orderId: string
): Promise<void> => {
  const [o] = await database
    .select({ schoolId: uniformOrders.schoolId })
    .from(uniformOrders)
    .where(eq(uniformOrders.id, orderId));
  if (!o || scope.includes(o.schoolId)) return;
  throw new AccessHttpError(403, "Akses order di luar sekolah penugasan dilarang");
};

/**
 * Daftar order seragam ber-scope (filter sekolah/status/tahap/pencarian dalam
 * sekolah) + jumlah klaim pembayaran pending per baris dalam satu grup-baca.
 * Pencarian wajib terpartisi sekolah (penegakan di route).
 */
export async function listUniformOrders(database: AppDatabase, filters: UniformOrderListFilters) {
  const conditions = [];
  if (filters.schoolId) conditions.push(eq(uniformOrders.schoolId, filters.schoolId));
  if (filters.shipmentStatus === "belum_dikirim" || filters.shipmentStatus === "sudah_dikirim") {
    conditions.push(eq(uniformOrders.shipmentStatus, filters.shipmentStatus));
  }
  if (
    filters.paymentStatus === "unpaid" ||
    filters.paymentStatus === "partial" ||
    filters.paymentStatus === "paid" ||
    filters.paymentStatus === "scholarship_pending"
  ) {
    conditions.push(eq(uniformOrders.paymentStatus, filters.paymentStatus));
  }
  conditions.push(...uniformStageFilter(filters.stage));
  if (filters.search) {
    const matched = matchAnyLower([students.name, students.nis, uniformOrders.orderNumber], filters.search);
    if (matched) conditions.push(matched);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const isPaginated = filters.page !== undefined || filters.limit !== undefined;
  const { page, limit, offset } = parsePaginationParams({
    page: filters.page,
    limit: filters.limit,
  });

  let total = 0;
  if (isPaginated) {
    const [totalRow] = await database
      .select({ count: sql<number>`count(*)` })
      .from(uniformOrders)
      .innerJoin(students, eq(uniformOrders.studentId, students.id))
      .innerJoin(schools, eq(uniformOrders.schoolId, schools.id))
      .where(whereClause)
      .limit(1);
    total = Number(totalRow?.count ?? 0);
  }

  const rows = await database
    .select({
      id: uniformOrders.id,
      orderNumber: uniformOrders.orderNumber,
      studentId: uniformOrders.studentId,
      studentName: students.name,
      nis: students.nis,
      gradeLevel: students.gradeLevel,
      schoolId: uniformOrders.schoolId,
      schoolName: schools.name,
      shipmentStatus: uniformOrders.shipmentStatus,
      shippedAt: uniformOrders.shippedAt,
      shippingCost: uniformOrders.shippingCost,
      shippingResi: uniformOrders.shippingResi,
      invoiceSentAt: uniformOrders.invoiceSentAt,
      paymentStatus: uniformOrders.paymentStatus,
      orderType: uniformOrders.orderType,
      totalAmount: uniformOrders.totalAmount,
      paidAmount: uniformOrders.paidAmount,
      homeAddressSnapshot: uniformOrders.homeAddressSnapshot,
      createdAt: uniformOrders.createdAt,
    })
    .from(uniformOrders)
    .innerJoin(students, eq(uniformOrders.studentId, students.id))
    .innerJoin(schools, eq(uniformOrders.schoolId, schools.id))
    .where(whereClause)
    .orderBy(desc(uniformOrders.createdAt))
    .limit(limit)
    .offset(isPaginated ? offset : 0);

  const pending = await pendingPaymentCounts(database, "seragam", rows.map((r) => r.id));
  const items = rows.map((r) => ({ ...r, stage: uniformOrderStage(r), pendingCount: pending.get(r.id) ?? 0 }));

  if (isPaginated) {
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  return items;
}
