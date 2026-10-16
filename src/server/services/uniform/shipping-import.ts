import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { students, uniformOrders } from "../../../db/schema";

export interface ImportShippingRow {
  nis: string;
  resi: string;
  ongkir: number;
}

export interface ImportShippingResult {
  updated: string[];
  rejected: Array<{ nis: string; reason: string }>;
}

/**
 * Satu-satunya pemilik import ekspedisi: cocokkan NIS → order terbaru
 * dalam partisi sekolah, tulis ongkir/resi sekuensial (§10: tulis
 * dilarang Promise.all). Route hanya menegakkan scope + peran.
 * Modul mutasi sendiri (bukan reporting) agar report.ts berubah hanya
 * untuk alasan rekap.
 */
export const importUniformShipping = async (
  database: AppDatabase,
  schoolId: string,
  rows: ImportShippingRow[],
  markShipped: boolean
): Promise<ImportShippingResult> => {
  const updated: string[] = [];
  const rejected: Array<{ nis: string; reason: string }> = [];
  for (const row of rows) {
    const nis = row.nis.trim();
    const [student] = await database
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.nis, nis)))
      .limit(1);
    if (!student) {
      rejected.push({ nis, reason: "NIS tidak ditemukan (baris ditolak)." });
      continue;
    }
    const [order] = await database
      .select()
      .from(uniformOrders)
      .where(eq(uniformOrders.studentId, student.id))
      .orderBy(desc(uniformOrders.createdAt))
      .limit(1);
    if (!order || order.schoolId !== schoolId) {
      rejected.push({ nis, reason: "Tidak ada order seragam murid ini di sekolah tersebut." });
      continue;
    }
    const now = new Date().toISOString();
    await database
      .update(uniformOrders)
      .set({
        shippingCost: row.ongkir,
        shippingResi: row.resi.trim() || order.shippingResi,
        shipmentStatus: markShipped ? "sudah_dikirim" : order.shipmentStatus,
        shippedAt: markShipped ? (order.shippedAt ?? now) : order.shippedAt,
        updatedAt: now,
      })
      .where(eq(uniformOrders.id, order.id));
    updated.push(nis);
  }
  return { updated, rejected };
};
