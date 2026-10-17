import { and, eq, notInArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { schools, students } from "../../db/schema";
import { matchAnyLower } from "../lib/partitioned-search";
import { validateStudentForOrder } from "./order-intake/validation";
import { paymentRowStatus } from "./order-payment-review";
import { toEligibilityView } from "./student-lifecycle";

/**
 * Satu-satunya seam portal publik: Pencarian Partisi (school_id + LIKE +
 * LIMIT 10 + filter new_pending/rejected) dan bentuk confirm-order tinggal
 * di balik satu interface. Buku vs Seragam hanya adaptor kolom di tepi.
 */

export interface VerifiedStudentRow {
  id: string;
  nis: string;
  name: string;
  gender: string;
  gradeLevel: string;
  curriculumType: string;
  academicYear: string;
  status: string;
  isScholarship: boolean;
  schoolId: string;
  schoolName: string;
  parentName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
}

/** Cari murid terverifikasi dalam satu sekolah (Pencarian Partisi §11). */
export const searchVerifiedStudents = async (
  database: AppDatabase,
  query: string,
  schoolId: string
): Promise<VerifiedStudentRow[]> =>
  database
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      gender: students.gender,
      gradeLevel: students.gradeLevel,
      curriculumType: students.curriculumType,
      academicYear: students.academicYear,
      status: students.status,
      isScholarship: students.isScholarship,
      schoolId: students.schoolId,
      schoolName: schools.name,
      parentName: students.parentName,
      parentEmail: students.parentEmail,
      parentPhone: students.parentPhone,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(
      and(
        eq(students.schoolId, schoolId),
        matchAnyLower([students.name, students.nis], query),
        notInArray(students.status, ["new_pending", "rejected"])
      )
    )
    .limit(10);

/** Bentuk baris portal buku: kolom yang sama persis dengan sebelumnya + kelayakan. */
export const toBookSearchView = (row: VerifiedStudentRow) => ({
  id: row.id,
  nis: row.nis,
  name: row.name,
  gradeLevel: row.gradeLevel,
  curriculumType: row.curriculumType,
  academicYear: row.academicYear,
  status: row.status,
  isScholarship: row.isScholarship,
  schoolId: row.schoolId,
  schoolName: row.schoolName,
  parentName: row.parentName,
  parentEmail: row.parentEmail,
  parentPhone: row.parentPhone,
  ...toEligibilityView(row, validateStudentForOrder(row)),
});

export interface UniformSearchView {
  id: string;
  nis: string;
  name: string;
  gender: string;
  gradeLevel: string;
  academicYear: string;
  status: string;
  schoolId: string;
  schoolName: string;
  parentName: string | null;
  parentPhone: string | null;
}

/** Bentuk baris portal seragam: subset kolom yang sama persis dengan sebelumnya. */
export const toUniformSearchView = (row: VerifiedStudentRow): UniformSearchView => ({
  id: row.id,
  nis: row.nis,
  name: row.name,
  gender: row.gender,
  gradeLevel: row.gradeLevel,
  academicYear: row.academicYear,
  status: row.status,
  schoolId: row.schoolId,
  schoolName: row.schoolName,
  parentName: row.parentName,
  parentPhone: row.parentPhone,
});

/** Ringkasan klaim transfer ortu untuk banner portal (terbaru lebih dulu). */
export interface ConfirmPaymentSummary {
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectReason?: string | null;
}

export interface ConfirmOrderSource {
  student?: { name?: string | null } | null;
  order: {
    orderNumber: string;
    totalAmount: number;
    shippingCost?: number | null;
    paidAmount: number;
    paymentStatus: string;
    invoiceSentAt?: string | null;
  };
  due: number;
  payments?: ConfirmPaymentSummary[];
}

/** Bentuk confirm-order portal: kolom yang sama untuk Buku dan Seragam + status klaim terakhir. */
export const toConfirmOrderView = (found: ConfirmOrderSource) => {
  const latest = found.payments?.[0];
  return {
    studentName: found.student?.name ?? null,
    orderNumber: found.order.orderNumber,
    totalAmount: found.order.totalAmount,
    shippingCost: found.order.shippingCost ?? 0,
    due: found.due,
    paidAmount: found.order.paidAmount,
    paymentStatus: found.order.paymentStatus,
    invoiceSentAt: found.order.invoiceSentAt,
    latestPaymentStatus: latest ? paymentRowStatus(latest) : null,
    latestRejectReason: latest?.rejectReason ?? null,
  };
};
