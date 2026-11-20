import * as XLSX from "xlsx";
import { and, eq, gte, isNotNull, isNull, lt, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  paymentReceipts,
  paymentAllocations,
  students,
  schools,
} from "../../db/schema";
import { selectInChunks } from "../lib/d1-write";
import { periodBounds } from "../lib/period";

export interface BankTransferReconciliationRow {
  receiptId: string;
  allocationId: string;
  studentName: string;
  nis: string;
  schoolName: string;
  transferDate: string;
  totalTransfer: number;
  allocationAmount: number;
  transferTarget: "Buku" | "Seragam";
  bankName: string;
  referenceNumber: string | null;
}

export async function fetchBankTransferReconciliation(
  database: AppDatabase,
  input: { period: string; schoolId?: string }
): Promise<BankTransferReconciliationRow[]> {
  const { start, end } = periodBounds(input.period);
  const schoolScope = input.schoolId;

  const receiptConditions = [
    eq(paymentReceipts.direction, "in"),
    gte(paymentReceipts.receivedAt, start),
    lt(paymentReceipts.receivedAt, end),
    isNotNull(paymentReceipts.verifiedAt),
    isNull(paymentReceipts.rejectedAt),
    schoolScope ? eq(paymentReceipts.schoolId, schoolScope) : undefined,
  ];

  const receipts = await database
    .select({
      id: paymentReceipts.id,
      studentId: paymentReceipts.studentId,
      schoolId: paymentReceipts.schoolId,
      amount: paymentReceipts.amount,
      bankName: paymentReceipts.bankName,
      referenceNumber: paymentReceipts.referenceNumber,
      receivedAt: paymentReceipts.receivedAt,
    })
    .from(paymentReceipts)
    .where(and(...receiptConditions));

  if (receipts.length === 0) return [];

  const receiptIds = receipts.map((r) => r.id);
  const allocations = await selectInChunks(receiptIds, (chunk) =>
    database
      .select({
        id: paymentAllocations.id,
        receiptId: paymentAllocations.receiptId,
        orderId: paymentAllocations.orderId,
        kind: paymentAllocations.kind,
        amount: paymentAllocations.amount,
      })
      .from(paymentAllocations)
      .where(inArray(paymentAllocations.receiptId, chunk))
  );

  const studentIds = [...new Set(receipts.map((r) => r.studentId))];
  const studentRows = await selectInChunks(studentIds, (chunk) =>
    database
      .select({
        id: students.id,
        name: students.name,
        nis: students.nis,
      })
      .from(students)
      .where(inArray(students.id, chunk))
  );
  const studentMap = new Map(studentRows.map((s) => [s.id, s]));

  const schoolIds = [...new Set(receipts.map((r) => r.schoolId))];
  const schoolRows = await selectInChunks(schoolIds, (chunk) =>
    database
      .select({
        id: schools.id,
        name: schools.name,
        code: schools.code,
      })
      .from(schools)
      .where(inArray(schools.id, chunk))
  );
  const schoolMap = new Map(schoolRows.map((s) => [s.id, s.name]));

  const receiptMap = new Map(receipts.map((r) => [r.id, r]));

  const rows: BankTransferReconciliationRow[] = [];

  for (const alloc of allocations) {
    const rc = receiptMap.get(alloc.receiptId);
    if (!rc) continue;

    const st = studentMap.get(rc.studentId);
    const schoolName = schoolMap.get(rc.schoolId) || rc.schoolId;
    const dateFormatted = rc.receivedAt ? rc.receivedAt.slice(0, 10) : "";

    rows.push({
      receiptId: rc.id,
      allocationId: alloc.id,
      studentName: st?.name || "—",
      nis: st?.nis || "—",
      schoolName,
      transferDate: dateFormatted,
      totalTransfer: rc.amount,
      allocationAmount: alloc.amount,
      transferTarget: alloc.kind === "buku" ? "Buku" : "Seragam",
      bankName: rc.bankName,
      referenceNumber: rc.referenceNumber,
    });
  }

  return rows;
}

export function buildReconciliationExcelBuffer(
  rows: BankTransferReconciliationRow[],
  period: string
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const headers = [
    "Nama Siswa",
    "NIS",
    "Sekolah",
    "Tanggal Transfer",
    "Total Transfer (Rp)",
    "Alokasi Transfer (Rp)",
    "Tujuan Transfer",
    "Bank",
    "No Referensi",
  ];
  const data = rows.map((r) => [
    r.studentName,
    r.nis,
    r.schoolName,
    r.transferDate,
    r.totalTransfer,
    r.allocationAmount,
    r.transferTarget,
    r.bankName,
    r.referenceNumber || "—",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  XLSX.utils.book_append_sheet(wb, ws, `Rekon-${period}`);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buffer);
}
