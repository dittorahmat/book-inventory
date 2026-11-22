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
  studentName: string;
  nis: string;
  schoolName: string;
  transferDate: string;
  totalTransfer: number;
  bookAllocation: number;
  uniformAllocation: number;
  unallocatedAmount: number;
  bankName: string;
  referenceNumber: string | null;
  verificationStatus: "verified" | "pending";
}

export async function fetchBankTransferReconciliation(
  database: AppDatabase,
  input: { period: string; schoolId?: string }
): Promise<BankTransferReconciliationRow[]> {
  const { start, end } = periodBounds(input.period);
  const schoolScope = input.schoolId && input.schoolId !== "all" ? input.schoolId : undefined;

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
      verifiedAt: paymentReceipts.verifiedAt,
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

  // Agregasi alokasi per receiptId
  const allocMap = new Map<string, { book: number; uniform: number }>();
  for (const alloc of allocations) {
    const existing = allocMap.get(alloc.receiptId) ?? { book: 0, uniform: 0 };
    if (alloc.kind === "buku") {
      existing.book += alloc.amount;
    } else if (alloc.kind === "seragam") {
      existing.uniform += alloc.amount;
    }
    allocMap.set(alloc.receiptId, existing);
  }

  const rows: BankTransferReconciliationRow[] = [];

  for (const rc of receipts) {
    const st = studentMap.get(rc.studentId);
    const schoolName = schoolMap.get(rc.schoolId) || rc.schoolId;
    const dateFormatted = rc.receivedAt ? rc.receivedAt.slice(0, 10) : "";
    const alloc = allocMap.get(rc.id) ?? { book: 0, uniform: 0 };
    const allocatedSum = alloc.book + alloc.uniform;
    const unallocatedAmount = Math.max(0, rc.amount - allocatedSum);

    rows.push({
      receiptId: rc.id,
      studentName: st?.name || "—",
      nis: st?.nis || "—",
      schoolName,
      transferDate: dateFormatted,
      totalTransfer: rc.amount,
      bookAllocation: alloc.book,
      uniformAllocation: alloc.uniform,
      unallocatedAmount,
      bankName: rc.bankName,
      referenceNumber: rc.referenceNumber,
      verificationStatus: rc.verifiedAt ? "verified" : "pending",
    });
  }

  // Urutkan berdasarkan tanggal transfer menurun lalu nama siswa
  return rows.sort((a, b) => {
    const dateCmp = b.transferDate.localeCompare(a.transferDate);
    if (dateCmp !== 0) return dateCmp;
    return a.studentName.localeCompare(b.studentName);
  });
}

export function buildReconciliationExcelBuffer(
  rows: BankTransferReconciliationRow[],
  period: string
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const headers = [
    "Tanggal Transfer",
    "Nama Siswa",
    "NIS",
    "Sekolah",
    "Bank",
    "No Referensi",
    "Total Transfer (Rp)",
    "Alokasi Buku (Rp)",
    "Alokasi Seragam (Rp)",
    "Sisa / Unallocated (Rp)",
    "Status Verifikasi",
  ];
  const data = rows.map((r) => [
    r.transferDate,
    r.studentName,
    r.nis,
    r.schoolName,
    r.bankName,
    r.referenceNumber || "—",
    r.totalTransfer,
    r.bookAllocation,
    r.uniformAllocation,
    r.unallocatedAmount,
    r.verificationStatus,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  XLSX.utils.book_append_sheet(wb, ws, `Rekon-${period}`);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buffer);
}
