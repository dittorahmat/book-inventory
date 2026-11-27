import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  internalShipments,
  teacherHandbookAllocations,
  teacherHandbookOrders,
} from "../../../db/schema";
import { d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { generateDeliveryNoteNumber } from "../internal-po/delivery-note";
import { TeacherHandbookError, getTeacherHandbookOrderById } from "./index";
import { computeAndSaveSettlementAmount } from "./settlement";

async function execBatch(
  db: AppDatabase,
  stmts: Parameters<typeof runWriteBatch>[1],
  fallbackMsg: string
) {
  try {
    await runWriteBatch(db, stmts);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, fallbackMsg);
    if (mapped) {
      throw new TeacherHandbookError(mapped.message, mapped.status);
    }
    throw err;
  }
}

/**
 * Mengirim Pesanan Pegangan Guru dari Gudang Pusat ke Cabang:
 * - Jika `shipmentId` diberikan, pesanan digabungkan ke Surat Jalan tersebut (Surat Jalan Gabungan).
 * - Jika tidak, sistem menerbitkan Surat Jalan baru di `internal_shipments`.
 */
export async function dispatchTeacherHandbookOrder(
  db: AppDatabase,
  orderId: string,
  shipmentId?: string | null,
  now: Date = new Date()
) {
  const [order] = await db
    .select()
    .from(teacherHandbookOrders)
    .where(eq(teacherHandbookOrders.id, orderId));
  if (!order) {
    throw new TeacherHandbookError("Pesanan Pegangan Guru tidak ditemukan.", 404);
  }
  if (order.status !== "pending") {
    throw new TeacherHandbookError("Hanya pesanan berstatus pending yang dapat dikirim.", 400);
  }

  const isoNow = now.toISOString();
  let targetShipmentId = shipmentId ?? null;

  if (targetShipmentId) {
    const [existingShipment] = await db
      .select()
      .from(internalShipments)
      .where(eq(internalShipments.id, targetShipmentId));
    if (!existingShipment) {
      throw new TeacherHandbookError("Surat Jalan tujuan tidak ditemukan.", 404);
    }
    if (existingShipment.destinationSchoolId !== order.schoolId) {
      throw new TeacherHandbookError("Surat Jalan tujuan bukan untuk cabang pemesan.", 400);
    }
  } else {
    targetShipmentId = crypto.randomUUID();
    const deliveryNoteNumber = await generateDeliveryNoteNumber(db, isoNow.slice(0, 10));
    await execBatch(
      db,
      [
        db.insert(internalShipments).values({
          id: targetShipmentId,
          internalPoId: null,
          destinationSchoolId: order.schoolId,
          deliveryNoteNumber,
          shippedDate: isoNow.slice(0, 10),
          status: "in_transit",
          notes: `Pengiriman Pegangan Guru ${order.orderNumber}`,
          createdAt: isoNow,
          updatedAt: isoNow,
        }),
      ],
      "Gagal membuat Surat Jalan Pegangan Guru."
    );
  }

  await db
    .update(teacherHandbookOrders)
    .set({
      status: "in_transit",
      shipmentId: targetShipmentId,
      updatedAt: isoNow,
    })
    .where(eq(teacherHandbookOrders.id, orderId));

  return getTeacherHandbookOrderById(db, orderId);
}

/**
 * Konfirmasi penerimaan kiriman Pegangan Guru oleh cabang.
 * Menandai pesanan `received` dan mencatat `deliveredQuantity` tanpa mencampur ke stok jual siswa.
 */
export async function receiveTeacherHandbookOrder(
  db: AppDatabase,
  orderId: string,
  schoolScope?: string | null,
  now: Date = new Date()
) {
  const [order] = await db
    .select()
    .from(teacherHandbookOrders)
    .where(eq(teacherHandbookOrders.id, orderId));
  if (!order) {
    throw new TeacherHandbookError("Pesanan Pegangan Guru tidak ditemukan.", 404);
  }
  if (schoolScope && order.schoolId !== schoolScope) {
    throw new TeacherHandbookError("Tidak memiliki akses ke pesanan cabang lain.", 403);
  }
  if (order.status !== "in_transit") {
    throw new TeacherHandbookError("Hanya pesanan dalam pengiriman (in_transit) yang dapat diterima.", 400);
  }

  const allocations = await db
    .select()
    .from(teacherHandbookAllocations)
    .where(eq(teacherHandbookAllocations.orderId, orderId));

  const isoNow = now.toISOString();
  await execBatch(
    db,
    [
      db
        .update(teacherHandbookOrders)
        .set({ status: "received", updatedAt: isoNow })
        .where(eq(teacherHandbookOrders.id, orderId)),
      ...allocations.map((a) =>
        db
          .update(teacherHandbookAllocations)
          .set({ deliveredQuantity: a.quantity, updatedAt: isoNow })
          .where(eq(teacherHandbookAllocations.id, a.id))
      ),
    ],
    "Gagal mengonfirmasi penerimaan Pegangan Guru."
  );

  await computeAndSaveSettlementAmount(db, orderId, now);

  return getTeacherHandbookOrderById(db, orderId);
}

/**
 * Mencatat serah terima fisik buku Pegangan Guru kepada guru penerima.
 */
export async function handoverTeacherAllocation(
  db: AppDatabase,
  allocationId: string,
  quantity: number,
  schoolScope?: string | null,
  now: Date = new Date()
) {
  const [alloc] = await db
    .select()
    .from(teacherHandbookAllocations)
    .where(eq(teacherHandbookAllocations.id, allocationId));
  if (!alloc) {
    throw new TeacherHandbookError("Alokasi guru tidak ditemukan.", 404);
  }

  const [order] = await db
    .select()
    .from(teacherHandbookOrders)
    .where(eq(teacherHandbookOrders.id, alloc.orderId));
  if (!order) {
    throw new TeacherHandbookError("Pesanan Pegangan Guru tidak ditemukan.", 404);
  }
  if (schoolScope && order.schoolId !== schoolScope) {
    throw new TeacherHandbookError("Tidak memiliki akses ke pesanan cabang lain.", 403);
  }
  if (order.status !== "received" && order.status !== "completed") {
    throw new TeacherHandbookError("Buku harus diterima cabang terlebih dahulu sebelum diserahkan ke guru.", 400);
  }

  const nextHandedOver = alloc.handedOverQuantity + quantity;
  if (nextHandedOver > alloc.deliveredQuantity) {
    throw new TeacherHandbookError("Jumlah serah terima melebihi jumlah buku yang diterima cabang.", 400);
  }

  const isoNow = now.toISOString();
  await db
    .update(teacherHandbookAllocations)
    .set({
      handedOverQuantity: nextHandedOver,
      handedOverAt: isoNow,
      updatedAt: isoNow,
    })
    .where(eq(teacherHandbookAllocations.id, allocationId));

  const allAllocs = await db
    .select()
    .from(teacherHandbookAllocations)
    .where(eq(teacherHandbookAllocations.orderId, order.id));
  const allDone = allAllocs.every((a) => a.handedOverQuantity >= a.deliveredQuantity);
  if (allDone && order.status !== "completed") {
    await db
      .update(teacherHandbookOrders)
      .set({ status: "completed", updatedAt: isoNow })
      .where(eq(teacherHandbookOrders.id, order.id));
  }

  return getTeacherHandbookOrderById(db, order.id);
}

/**
 * Mengalihkan alokasi buku ke guru lain di cabang yang sama setelah buku diterima.
 */
export async function reassignTeacherAllocation(
  db: AppDatabase,
  allocationId: string,
  input: {
    teacherName: string;
    gradeLevel?: string | null;
    rombel?: string | null;
    subject?: string | null;
  },
  schoolScope?: string | null,
  now: Date = new Date()
) {
  const [alloc] = await db
    .select()
    .from(teacherHandbookAllocations)
    .where(eq(teacherHandbookAllocations.id, allocationId));
  if (!alloc) {
    throw new TeacherHandbookError("Alokasi guru tidak ditemukan.", 404);
  }

  const [order] = await db
    .select()
    .from(teacherHandbookOrders)
    .where(eq(teacherHandbookOrders.id, alloc.orderId));
  if (!order) {
    throw new TeacherHandbookError("Pesanan Pegangan Guru tidak ditemukan.", 404);
  }
  if (schoolScope && order.schoolId !== schoolScope) {
    throw new TeacherHandbookError("Tidak memiliki akses ke pesanan cabang lain.", 403);
  }

  await db
    .update(teacherHandbookAllocations)
    .set({
      teacherName: input.teacherName.trim(),
      gradeLevel: input.gradeLevel?.trim() || null,
      rombel: input.rombel?.trim() || null,
      subject: input.subject?.trim() || null,
      updatedAt: now.toISOString(),
    })
    .where(eq(teacherHandbookAllocations.id, allocationId));

  return getTeacherHandbookOrderById(db, order.id);
}
