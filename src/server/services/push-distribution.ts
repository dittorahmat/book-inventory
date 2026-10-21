import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookPackages, students } from "../../db/schema";
import { createManualShipment, type CreateManualShipmentResult } from "./internal-po/shipment";
import { documentNumber, epochTimeFragment, randomSerial } from "../lib/document-number";

export interface StudentCapRow {
  grade: string;
  studentCount: number;
  packageId: string | null;
  packageName: string | null;
  recommendedQuantity: number;
}

export interface PushDistributionSummary {
  schoolId: string;
  totalActiveStudents: number;
  grades: StudentCapRow[];
}

export interface BulkPushShipmentItem {
  packageId: string;
  quantity: number;
}

export interface CreatePushShipmentInput {
  schoolId: string;
  deliveryNoteNumber?: string;
  shippedDate?: string;
  notes?: string;
  items: BulkPushShipmentItem[];
}

/**
 * Menghitung kuota siswa aktif di sekolah/cabang per jenjang kelas untuk menentukan Cap Max alokasi buku.
 */
export async function calculateSchoolPushQuota(
  database: AppDatabase,
  schoolId: string,
  academicYear?: string
): Promise<PushDistributionSummary> {
  const conditions = [eq(students.schoolId, schoolId), eq(students.status, "active")];
  if (academicYear) {
    conditions.push(eq(students.academicYear, academicYear));
  }

  const studentCounts = await database
    .select({
      grade: students.gradeLevel,
      count: sql<number>`count(${students.id})`,
    })
    .from(students)
    .where(and(...conditions))
    .groupBy(students.gradeLevel);

  const availablePackages = await database
    .select({
      id: bookPackages.id,
      name: bookPackages.name,
      targetGrade: bookPackages.gradeLevel,
    })
    .from(bookPackages);

  const packageByGrade = new Map<string, { id: string; name: string }>();
  for (const pkg of availablePackages) {
    if (pkg.targetGrade && !packageByGrade.has(pkg.targetGrade)) {
      packageByGrade.set(pkg.targetGrade, { id: pkg.id, name: pkg.name });
    }
  }

  let totalActiveStudents = 0;
  const grades: StudentCapRow[] = studentCounts.map((row) => {
    const studentCount = Number(row.count ?? 0);
    totalActiveStudents += studentCount;
    const pkg = packageByGrade.get(row.grade);
    return {
      grade: row.grade,
      studentCount,
      packageId: pkg?.id ?? null,
      packageName: pkg?.name ?? null,
      recommendedQuantity: studentCount,
    };
  });

  return {
    schoolId,
    totalActiveStudents,
    grades,
  };
}

/**
 * Menerbitkan Surat Jalan pengiriman Push Distribution langsung ke cabang.
 */
export async function createPushDistributionShipment(
  database: AppDatabase,
  input: CreatePushShipmentInput
): Promise<CreateManualShipmentResult> {
  const deliveryNoteNumber =
    input.deliveryNoteNumber?.trim() ||
    documentNumber("TRF", epochTimeFragment(Date.now(), 6), randomSerial(6));
  
  const items = input.items.map((it) => ({
    packageId: it.packageId,
    quantity: it.quantity,
    isOutstandingFollowup: false,
  }));

  return createManualShipment(database, {
    destinationSchoolId: input.schoolId,
    deliveryNoteNumber,
    shippedDate: input.shippedDate,
    notes: input.notes ? `[Push Distribution] ${input.notes}` : "[Push Distribution Awal Tahun]",
    items,
  });
}
