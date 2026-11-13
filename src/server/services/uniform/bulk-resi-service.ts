import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { students, uniformOrders } from "../../../db/schema";
import { d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { normalizeCsvNis } from "./csv-row";
import { sendUniformShippingNotification } from "./dispatch-notification";

export interface BulkResiPreviewItem {
  nis: string;
  name: string;
  resi: string;
  status: "valid" | "warning" | "error";
  orderId?: string;
  orderNumber?: string;
  studentName?: string;
  message?: string;
}

export interface BulkResiPreviewResult {
  items: BulkResiPreviewItem[];
  validCount: number;
  errorCount: number;
}

/**
 * Melakukan preview dan verifikasi baris bulk resi tanpa mutasi DB.
 */
export async function previewBulkUniformResi(
  database: AppDatabase,
  rows: Array<{ nis: string; name: string; resi: string }>,
  schoolId?: string
): Promise<BulkResiPreviewResult> {
  const items: BulkResiPreviewItem[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    const nis = normalizeCsvNis(row.nis);
    const resi = row.resi.trim();

    if (!nis || !resi) {
      items.push({
        ...row,
        status: "error",
        message: "NIS dan Resi wajib diisi.",
      });
      errorCount++;
      continue;
    }

    const conditions = [eq(students.nis, nis)];
    if (schoolId) conditions.push(eq(students.schoolId, schoolId));

    const [st] = await database
      .select({ id: students.id, name: students.name, schoolId: students.schoolId })
      .from(students)
      .where(and(...conditions))
      .limit(1);

    if (!st) {
      items.push({
        ...row,
        status: "error",
        message: `Siswa dengan NIS ${nis} tidak ditemukan.`,
      });
      errorCount++;
      continue;
    }

    // Validasi kesesuaian nama siswa (case-insensitive substring)
    const normalizedInputName = row.name.trim().toLowerCase();
    const normalizedDbName = st.name.trim().toLowerCase();
    const nameMatches =
      !normalizedInputName ||
      normalizedDbName.includes(normalizedInputName) ||
      normalizedInputName.includes(normalizedDbName);

    if (!nameMatches) {
      items.push({
        ...row,
        status: "error",
        studentName: st.name,
        message: `Nama di file (${row.name}) tidak cocok dengan master siswa (${st.name}).`,
      });
      errorCount++;
      continue;
    }

    // Cari order seragam yang statusnya masih belum_dikirim
    const [order] = await database
      .select({ id: uniformOrders.id, orderNumber: uniformOrders.orderNumber, shipmentStatus: uniformOrders.shipmentStatus })
      .from(uniformOrders)
      .where(and(eq(uniformOrders.studentId, st.id), eq(uniformOrders.shipmentStatus, "belum_dikirim")))
      .orderBy(desc(uniformOrders.createdAt))
      .limit(1);

    if (!order) {
      // Cek apakah order sudah berstatus sudah_dikirim sebelumnya
      const [shippedOrder] = await database
        .select({ id: uniformOrders.id, orderNumber: uniformOrders.orderNumber })
        .from(uniformOrders)
        .where(and(eq(uniformOrders.studentId, st.id), eq(uniformOrders.shipmentStatus, "sudah_dikirim")))
        .orderBy(desc(uniformOrders.createdAt))
        .limit(1);

      if (shippedOrder) {
        items.push({
          ...row,
          status: "warning",
          orderId: shippedOrder.id,
          orderNumber: shippedOrder.orderNumber,
          studentName: st.name,
          message: `Pesanan (${shippedOrder.orderNumber}) sudah dikirim sebelumnya. Resi akan ditimpa.`,
        });
        validCount++;
        continue;
      }

      items.push({
        ...row,
        status: "error",
        studentName: st.name,
        message: `Tidak ditemukan pesanan seragam aktif untuk ${st.name}.`,
      });
      errorCount++;
      continue;
    }

    items.push({
      ...row,
      status: "valid",
      orderId: order.id,
      orderNumber: order.orderNumber,
      studentName: st.name,
    });
    validCount++;
  }

  return { items, validCount, errorCount };
}

export interface CommitBulkResiResult {
  updatedCount: number;
  results: Array<{ nis: string; orderNumber: string; resi: string; success: boolean }>;
}

/**
 * Mengeksekusi commit perubahan resi pengiriman massal ke database.
 */
export async function commitBulkUniformResi(
  database: AppDatabase,
  rows: Array<{ nis: string; name: string; resi: string }>,
  schoolId?: string
): Promise<CommitBulkResiResult> {
  const preview = await previewBulkUniformResi(database, rows, schoolId);
  const now = new Date().toISOString();
  let updatedCount = 0;
  const results: Array<{ nis: string; orderNumber: string; resi: string; success: boolean }> = [];

  for (const item of preview.items) {
    if (item.status === "error" || !item.orderId || !item.orderNumber) {
      results.push({ nis: item.nis, orderNumber: item.orderNumber || "-", resi: item.resi, success: false });
      continue;
    }

    try {
      await runWriteBatch(database, [
        database
          .update(uniformOrders)
          .set({
            shippingResi: item.resi,
            shipmentStatus: "sudah_dikirim",
            shippedAt: now,
            updatedAt: now,
          })
          .where(eq(uniformOrders.id, item.orderId)),
      ]);

      // Kirim notifikasi pengiriman jika ada
      await sendUniformShippingNotification(database, item.orderId).catch(() => null);

      updatedCount++;
      results.push({ nis: item.nis, orderNumber: item.orderNumber, resi: item.resi, success: true });
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "bulk update resi");
      results.push({
        nis: item.nis,
        orderNumber: item.orderNumber,
        resi: item.resi,
        success: false,
      });
      void mapped;
    }
  }

  return { updatedCount, results };
}
