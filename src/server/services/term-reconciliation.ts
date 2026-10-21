import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  bookPackages,
  internalShipmentItems,
  internalShipments,
  studentBookOrders,
  students,
  termReconciliationItems,
  termReconciliations,
} from "../../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { documentNumber, epochTimeFragment, randomSerial } from "../lib/document-number";

export interface CompileTermAuditInput {
  schoolId: string;
  academicYear: string;
  term: string;
}

export interface TermAuditPackageRow {
  packageId: string;
  packageName: string;
  packageCode: string | null;
  targetGrade: string | null;
  unitPrice: number;
  totalInbound: number;
  totalDistributed: number;
  systemRemaining: number;
}

export interface CompiledAuditData {
  schoolId: string;
  academicYear: string;
  term: string;
  packages: TermAuditPackageRow[];
}

export interface SaveReconciliationItemInput {
  itemType?: "package" | "book";
  packageId?: string;
  bookId?: string;
  totalInbound: number;
  totalDistributed: number;
  physicalRemaining: number;
  unitPrice?: number;
  notes?: string;
}

export interface SaveReconciliationInput {
  schoolId: string;
  academicYear: string;
  term: string;
  notes?: string;
  createdByUserId?: string;
  items: SaveReconciliationItemInput[];
}

/**
 * Mengompilasi data inbound (Surat Jalan masuk ke cabang) dan penyerahan siswa (order status picked_up)
 * untuk sesi audit akhir periode.
 */
export async function compileTermAuditData(
  database: AppDatabase,
  input: CompileTermAuditInput
): Promise<CompiledAuditData> {
  const { schoolId } = input;

  // 1. Ambil semua paket
  const allPackages = await database
    .select({
      id: bookPackages.id,
      name: bookPackages.name,
      code: bookPackages.code,
      targetGrade: bookPackages.gradeLevel,
      price: bookPackages.price,
    })
    .from(bookPackages);

  // 2. Hitung total paket yang terkirim ke cabang ini (internal shipments yang SUDAH diterima cabang)
  const inboundRecords = await database
    .select({
      packageId: internalShipmentItems.packageId,
      totalQty: sql<number>`coalesce(sum(${internalShipmentItems.quantity}), 0)`,
    })
    .from(internalShipments)
    .innerJoin(internalShipmentItems, eq(internalShipments.id, internalShipmentItems.shipmentId))
    .where(
      and(
        eq(internalShipments.destinationSchoolId, schoolId),
        sql`${internalShipments.status} = 'delivered' or ${internalShipments.status} = 'received' or ${internalShipments.status} = 'completed'`
      )
    )
    .groupBy(internalShipmentItems.packageId);

  const inboundMap = new Map<string, number>();
  for (const row of inboundRecords) {
    if (row.packageId) {
      inboundMap.set(row.packageId, Number(row.totalQty ?? 0));
    }
  }

  // 3. Hitung total paket yang telah benar-benar diserahkan ke siswa di cabang ini (fulfillmentStatus = picked_up)
  const distributedRecords = await database
    .select({
      packageId: studentBookOrders.packageId,
      totalQty: sql<number>`count(${studentBookOrders.id})`,
    })
    .from(studentBookOrders)
    .where(
      and(
        eq(studentBookOrders.schoolId, schoolId),
        eq(studentBookOrders.fulfillmentStatus, "picked_up")
      )
    )
    .groupBy(studentBookOrders.packageId);

  const distributedMap = new Map<string, number>();
  for (const row of distributedRecords) {
    if (row.packageId) {
      distributedMap.set(row.packageId, Number(row.totalQty ?? 0));
    }
  }

  const packages: TermAuditPackageRow[] = allPackages.map((pkg) => {
    const totalInbound = inboundMap.get(pkg.id) ?? 0;
    const totalDistributed = distributedMap.get(pkg.id) ?? 0;
    const systemRemaining = Math.max(0, totalInbound - totalDistributed);
    return {
      packageId: pkg.id,
      packageName: pkg.name,
      packageCode: pkg.code,
      targetGrade: pkg.targetGrade,
      unitPrice: pkg.price ?? 0,
      totalInbound,
      totalDistributed,
      systemRemaining,
    };
  });

  return {
    schoolId,
    academicYear: input.academicYear,
    term: input.term,
    packages,
  };
}

export type SaveReconciliationResult =
  | { ok: true; data: { id: string; reconciliationNumber: string } }
  | { ok: false; status: 400 | 404 | 409; message: string };

export type FinalizeReconciliationResult =
  | { ok: true; data: { id: string } }
  | { ok: false; status: 400 | 404; message: string };

/**
 * Menyimpan atau memperbarui dokumen rekonsiliasi akhir periode beserta item auditnya.
 */
export async function saveTermReconciliation(
  database: AppDatabase,
  input: SaveReconciliationInput,
  deps: { now?: () => string; generateId?: () => string } = {}
): Promise<SaveReconciliationResult> {
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const reconId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const reconNumber = documentNumber("BA-RECON", epochTimeFragment(Date.now(), 6), randomSerial(6));

  let totalInbound = 0;
  let totalDistributed = 0;
  let totalSystemRemaining = 0;
  let totalPhysicalRemaining = 0;
  let totalDiscrepancy = 0;
  let totalLossAmount = 0;

  const itemRows = input.items.map((it) => {
    const inbound = Math.max(0, it.totalInbound);
    const distributed = Math.max(0, it.totalDistributed);
    const systemRemaining = Math.max(0, inbound - distributed);
    const physical = Math.max(0, it.physicalRemaining);
    const discrepancy = Math.max(0, systemRemaining - physical);
    const unitPrice = Math.max(0, it.unitPrice ?? 0);
    const lossAmount = discrepancy * unitPrice;

    totalInbound += inbound;
    totalDistributed += distributed;
    totalSystemRemaining += systemRemaining;
    totalPhysicalRemaining += physical;
    totalDiscrepancy += discrepancy;
    totalLossAmount += lossAmount;

    return {
      id: crypto.randomUUID(),
      reconciliationId: reconId,
      itemType: it.itemType ?? "package",
      packageId: it.packageId || null,
      bookId: it.bookId || null,
      totalInbound: inbound,
      totalDistributed: distributed,
      systemRemaining,
      physicalRemaining: physical,
      discrepancyQuantity: discrepancy,
      unitPrice,
      totalLossAmount: lossAmount,
      notes: it.notes || null,
      createdAt: now,
      updatedAt: now,
    };
  });

  try {
    await runWriteBatch(database, [
      database.insert(termReconciliations).values({
        id: reconId,
        reconciliationNumber: reconNumber,
        schoolId: input.schoolId,
        academicYear: input.academicYear,
        term: input.term,
        status: "draft",
        notes: input.notes || null,
        totalInbound,
        totalDistributed,
        totalSystemRemaining,
        totalPhysicalRemaining,
        totalDiscrepancy,
        totalLossAmount,
        createdByUserId: input.createdByUserId || null,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(itemRows).map((chunk) => database.insert(termReconciliationItems).values(chunk)),
    ]);
    return { ok: true, data: { id: reconId, reconciliationNumber: reconNumber } };
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "menyimpan rekonsiliasi akhir periode");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
}

/**
 * Memfinalisasi dokumen rekonsiliasi akhir periode.
 */
export async function finalizeTermReconciliation(
  database: AppDatabase,
  reconciliationId: string,
  deps: { now?: () => string } = {}
): Promise<FinalizeReconciliationResult> {
  const now = (deps.now ?? (() => new Date().toISOString()))();
  try {
    await runWriteBatch(database, [
      database
        .update(termReconciliations)
        .set({
          status: "finalized",
          finalizedAt: now,
          updatedAt: now,
        })
        .where(eq(termReconciliations.id, reconciliationId)),
    ]);
    return { ok: true, data: { id: reconciliationId } };
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "memfinalisasi rekonsiliasi akhir periode");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
}

/**
 * Mengambil rekapitulasi data serah terima siswa untuk lampiran Berita Acara & Tagihan.
 */
export async function getStudentHandoverRecap(
  database: AppDatabase,
  schoolId: string
) {
  return database
    .select({
      orderId: studentBookOrders.id,
      orderNumber: studentBookOrders.orderNumber,
      studentId: students.id,
      studentName: students.name,
      nis: students.nis,
      grade: students.gradeLevel,
      packageName: bookPackages.name,
      status: studentBookOrders.fulfillmentStatus,
      handoverDate: studentBookOrders.handoverDate,
      deliveryNumber: studentBookOrders.handoverDeliveryNumber,
    })
    .from(studentBookOrders)
    .innerJoin(students, eq(studentBookOrders.studentId, students.id))
    .leftJoin(bookPackages, eq(studentBookOrders.packageId, bookPackages.id))
    .where(
      and(
        eq(studentBookOrders.schoolId, schoolId),
        eq(studentBookOrders.fulfillmentStatus, "picked_up")
      )
    )
    .orderBy(desc(studentBookOrders.createdAt))
    .limit(200);
}
