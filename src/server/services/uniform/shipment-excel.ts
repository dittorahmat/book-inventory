import * as XLSX from "xlsx";
import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  students,
  uniformOrders,
  uniformOrderItems,
  uniformVariants,
  uniformPackageBom,
} from "../../../db/schema";
import { gradeToJenjang } from "../../../lib/uniform-types";
import { selectInChunks } from "../reporting/sales-kernel";

export interface UniformEkspedisiRow {
  nis: string;
  namaSiswa: string;
  jenjang: string;
  jenisKelamin: string;
  namaPenerima: string;
  noKontak: string;
  alamat: string;
}

export interface UniformInternalLogistikRow {
  nis: string;
  namaSiswa: string;
  kelas: string;
  jenjang: string;
  jenisKelamin: string;
  sizeSeragamOlahraga: string;
}

export function parseRecipientFromAddress(
  address: string,
  fallbackName: string,
  fallbackPhone: string
): { recipientName: string; recipientPhone: string; cleanAddress: string } {
  const trimmed = (address || "").trim();
  // Format kanonik formatStructuredHomeAddress: "Nama (Phone) - Alamat..."
  const match = trimmed.match(/^([^(]+)\s*\(([^)]+)\)\s*-\s*(.+)$/);
  if (match) {
    return {
      recipientName: match[1].trim() || fallbackName,
      recipientPhone: match[2].trim() || fallbackPhone,
      cleanAddress: match[3].trim() || trimmed,
    };
  }
  return {
    recipientName: fallbackName,
    recipientPhone: fallbackPhone,
    cleanAddress: trimmed,
  };
}

export async function fetchUniformExcelData(
  database: AppDatabase,
  schoolId: string,
  paidOnly: boolean
): Promise<{ ekspedisi: UniformEkspedisiRow[]; internalLogistik: UniformInternalLogistikRow[] }> {
  const orders = await database
    .select()
    .from(uniformOrders)
    .where(
      paidOnly
        ? and(eq(uniformOrders.schoolId, schoolId), eq(uniformOrders.paymentStatus, "paid"))
        : eq(uniformOrders.schoolId, schoolId)
    );

  if (orders.length === 0) {
    return { ekspedisi: [], internalLogistik: [] };
  }

  const orderIds = orders.map((o) => o.id);
  const items = await selectInChunks(orderIds, (chunk) =>
    database.select().from(uniformOrderItems).where(inArray(uniformOrderItems.orderId, chunk))
  );

  const studentIds = [...new Set(orders.map((o) => o.studentId))];
  const studentRows = await selectInChunks(studentIds, (chunk) =>
    database
      .select({
        id: students.id,
        name: students.name,
        nis: students.nis,
        rombel: students.rombel,
        gradeLevel: students.gradeLevel,
        gender: students.gender,
        parentName: students.parentName,
        parentPhone: students.parentPhone,
      })
      .from(students)
      .where(inArray(students.id, chunk))
  );

  const byStudent = new Map(studentRows.map((s) => [s.id, s]));

  // Olahraga variants map
  const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean) as string[])];
  const variantRows = variantIds.length > 0
    ? await selectInChunks(variantIds, (chunk) =>
        database
          .select({ id: uniformVariants.id, kind: uniformVariants.kind })
          .from(uniformVariants)
          .where(inArray(uniformVariants.id, chunk))
      )
    : [];
  const variantKindMap = new Map(variantRows.map((v) => [v.id, v.kind]));

  // Paket BOM olahraga
  const packageIds = [...new Set(items.map((i) => i.packageId).filter(Boolean) as string[])];
  const bomRows = packageIds.length > 0
    ? await selectInChunks(packageIds, (chunk) =>
        database
          .select({
            packageId: uniformPackageBom.packageId,
            variantId: uniformPackageBom.variantId,
            kind: uniformVariants.kind,
          })
          .from(uniformPackageBom)
          .innerJoin(uniformVariants, eq(uniformPackageBom.variantId, uniformVariants.id))
          .where(inArray(uniformPackageBom.packageId, chunk))
      )
    : [];
  const packagesWithOlahraga = new Set(
    bomRows.filter((b) => b.kind === "olahraga").map((b) => b.packageId)
  );

  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
  }

  const ekspedisi: UniformEkspedisiRow[] = [];
  const internalLogistik: UniformInternalLogistikRow[] = [];

  for (const order of orders) {
    const st = byStudent.get(order.studentId);
    if (!st) continue;

    const orderItems = itemsByOrder.get(order.id) ?? [];
    const jenjang = gradeToJenjang(st.gradeLevel).toUpperCase();
    const jenisKelamin = st.gender === "female" ? "Perempuan" : "Laki-laki";

    // Format Ekspedisi: 1 baris per order
    const recipientInfo = parseRecipientFromAddress(
      order.homeAddressSnapshot,
      st.parentName || st.name,
      st.parentPhone || ""
    );

    ekspedisi.push({
      nis: st.nis,
      namaSiswa: st.name,
      jenjang,
      jenisKelamin,
      namaPenerima: recipientInfo.recipientName,
      noKontak: recipientInfo.recipientPhone,
      alamat: recipientInfo.cleanAddress,
    });

    // Format Internal Logistik: periksa size seragam olahraga
    const olahragaSizes: string[] = [];
    for (const it of orderItems) {
      if (it.variantId && variantKindMap.get(it.variantId) === "olahraga" && it.size && it.size !== "—") {
        olahragaSizes.push(it.size);
      } else if (it.packageId && packagesWithOlahraga.has(it.packageId) && it.size && it.size !== "—") {
        olahragaSizes.push(it.size);
      }
    }
    const sizeSeragamOlahraga = olahragaSizes.length > 0 ? olahragaSizes.join(", ") : "—";

    internalLogistik.push({
      nis: st.nis,
      namaSiswa: st.name,
      kelas: st.rombel || st.gradeLevel,
      jenjang,
      jenisKelamin,
      sizeSeragamOlahraga,
    });
  }

  return { ekspedisi, internalLogistik };
}

export function buildEkspedisiExcelBuffer(data: UniformEkspedisiRow[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const headers = [
    "NIS",
    "Nama Siswa",
    "Jenjang",
    "Jenis Kelamin",
    "Nama Penerima",
    "No Kontak",
    "Alamat",
  ];
  const rows = data.map((d) => [
    d.nis,
    d.namaSiswa,
    d.jenjang,
    d.jenisKelamin,
    d.namaPenerima,
    d.noKontak,
    d.alamat,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Ekspedisi");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buffer);
}

export function buildInternalLogistikExcelBuffer(data: UniformInternalLogistikRow[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const headers = [
    "NIS",
    "Nama Siswa",
    "Kelas",
    "Jenjang",
    "Jenis Kelamin",
    "Size Seragam Olahraga",
  ];
  const rows = data.map((d) => [
    d.nis,
    d.namaSiswa,
    d.kelas,
    d.jenjang,
    d.jenisKelamin,
    d.sizeSeragamOlahraga,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Internal Logistik");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buffer);
}
