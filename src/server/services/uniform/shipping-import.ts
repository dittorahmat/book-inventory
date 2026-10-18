import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { students, uniformOrders } from "../../../db/schema";
import { d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { finalizeChargeQuery } from "../branch-charges";
import { recomputeOrderPayment } from "../payment-ledger";
import { normalizeCsvNis, type UniformShippingCsvRow } from "./csv-row";

/** Baris import ekspedisi = arah pulang round-trip CSV berkunci NIS. */
export type ImportShippingRow = UniformShippingCsvRow;

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
    const nis = normalizeCsvNis(row.nis);
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
    // Impor massal juga "menginput ongkir": tagihan cabang wajib ikut final dan
    // status pembayaran dihitung ulang — kalau tidak, tagihan menggantung open.
    try {
      await runWriteBatch(database, [
        database
          .update(uniformOrders)
          .set({
            shippingCost: row.ongkir,
            shippingResi: row.resi.trim() || order.shippingResi,
            shipmentStatus: markShipped ? "sudah_dikirim" : order.shipmentStatus,
            shippedAt: markShipped ? (order.shippedAt ?? now) : order.shippedAt,
            updatedAt: now,
          })
          .where(eq(uniformOrders.id, order.id)),
        finalizeChargeQuery(database, "uniform_order", order.id, row.ongkir),
      ]);
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "impor ongkir seragam");
      if (!mapped) throw err;
      rejected.push({ nis, reason: mapped.message });
      continue;
    }
    await recomputeOrderPayment(database, "seragam", order.id, now);
    updated.push(nis);
  }
  return { updated, rejected };
};
