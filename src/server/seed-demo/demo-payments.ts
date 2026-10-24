import { eq } from "drizzle-orm";
import {
  bookReturns,
  paymentAllocations,
  paymentReceipts,
  studentBookOrders,
  uniformOrders,
} from "../../db/schema";
import { demoProofUrl, type SeedContext } from "./context";

export async function seedDemoPayments({ db: targetDb, now }: SeedContext) {
  // Token halaman bayar + ongkir untuk order buku.
  await targetDb
    .update(studentBookOrders)
    .set({
      paymentToken: "demo-token-buku-nathan",
      shippingCost: 25000,
      shippingResi: "JNE-BKU-0001",
      invoiceSentAt: now,
      updatedAt: now,
    })
    .where(eq(studentBookOrders.id, "ord-nathan-partial"));

  await targetDb
    .update(studentBookOrders)
    .set({
      paymentToken: "demo-token-buku-satuan",
      shippingCost: 25000,
      shippingResi: "JNE-BKU-0002",
      invoiceSentAt: now,
      updatedAt: now,
    })
    .where(eq(studentBookOrders.id, "ord-salsa-loose"));

  // Token halaman bayar untuk order seragam.
  await targetDb
    .update(uniformOrders)
    .set({ paymentToken: "demo-token-seragam-01", updatedAt: now })
    .where(eq(uniformOrders.id, "ord-demo-uso-01"));
  await targetDb
    .update(uniformOrders)
    .set({ paymentToken: "demo-token-seragam-03", updatedAt: now })
    .where(eq(uniformOrders.id, "ord-demo-uso-03"));

  // Struk pending: diverifikasi staf → Nathaniel lunas (500rb + 490rb = 990rb).
  await targetDb
    .insert(paymentReceipts)
    .values({
      id: "rcp-nathan-02",
      studentId: "std-nathan-4",
      schoolId: "school-alw-1",
      amount: 490000,
      bankName: "BCA",
      referenceNumber: "BCA-NTH-0002",
      proofUrl: demoProofUrl("Struk BCA Nathaniel"),
      receivedAt: now,
      notes: "Pelunasan sisa cicilan buku.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  await targetDb
    .insert(paymentAllocations)
    .values({
      id: "alc-nathan-02",
      receiptId: "rcp-nathan-02",
      orderId: "ord-nathan-partial",
      kind: "buku",
      amount: 490000,
      createdAt: now,
    })
    .onConflictDoNothing();

  // Struk verified seragam (USO-01 partial 100rb).
  await targetDb
    .insert(paymentReceipts)
    .values({
      id: "rcp-seragam-01",
      studentId: "std-aisyah-2",
      schoolId: "school-alw-1",
      amount: 100000,
      bankName: "BCA",
      referenceNumber: "BCA-SRG-0001",
      proofUrl: demoProofUrl("Struk BCA Seragam Aisyah"),
      receivedAt: now,
      verifiedAt: now,
      notes: "Cicilan pertama seragam.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  await targetDb
    .insert(paymentAllocations)
    .values({
      id: "alc-seragam-01",
      receiptId: "rcp-seragam-01",
      orderId: "ord-demo-uso-01",
      kind: "seragam",
      amount: 100000,
      createdAt: now,
    })
    .onConflictDoNothing();

  // Struk pending seragam (USO-03) untuk demo tolak/verifikasi.
  await targetDb
    .insert(paymentReceipts)
    .values({
      id: "rcp-seragam-02",
      studentId: "std-farhan-3",
      schoolId: "school-alw-1",
      amount: 230000,
      bankName: "Mandiri",
      referenceNumber: "MND-SRG-0002",
      proofUrl: demoProofUrl("Struk Mandiri Seragam Farhan"),
      receivedAt: now,
      notes: "Klaim pelunasan seragam.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  await targetDb
    .insert(paymentAllocations)
    .values({
      id: "alc-seragam-02",
      receiptId: "rcp-seragam-02",
      orderId: "ord-demo-uso-03",
      kind: "seragam",
      amount: 230000,
      createdAt: now,
    })
    .onConflictDoNothing();

  // Bukti beasiswa & foto retur yang benar-benar bisa dibuka.
  await targetDb
    .update(studentBookOrders)
    .set({ scholarshipProofUrl: demoProofUrl("Surat Beasiswa Tahfidz Farhan"), updatedAt: now })
    .where(eq(studentBookOrders.id, "ord-farhan-sch"));
  await targetDb
    .update(bookReturns)
    .set({ photoProofUrl: demoProofUrl("Foto Halaman Buku Rusak"), updatedAt: now })
    .where(eq(bookReturns.id, "ret-demo-1"));
}
