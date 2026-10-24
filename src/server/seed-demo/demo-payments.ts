import { eq } from "drizzle-orm";
import {
  bookReturns,
  studentBookOrders,
  uniformOrders,
} from "../../db/schema";
import { demoProofUrl, type SeedContext } from "./context";
import { seedReceipt } from "./receipt";

export async function seedDemoPayments({ db: targetDb, now }: SeedContext) {
  // Token halaman bayar. Paket buku diambil di sekolah → tanpa ongkir; order
  // satuan dikirim ke rumah → ongkir ikut menjadi bagian tagihan (ADR-0011).
  await targetDb
    .update(studentBookOrders)
    .set({
      paymentToken: "demo-token-buku-nathan",
      shippingCost: 0,
      shippingResi: null,
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
  await seedReceipt({ db: targetDb, now }, "rcp-nathan-02", {
    studentId: "std-nathan-4",
    schoolId: "school-alw-1",
    amount: 490000,
    allocations: [{ kind: "buku", orderId: "ord-nathan-partial", amount: 490000 }],
    bankName: "BCA",
    referenceNumber: "BCA-NTH-0002",
    proofUrl: demoProofUrl("Struk BCA Nathaniel"),
    notes: "Pelunasan sisa cicilan buku.",
  });

  // Struk verified seragam (USO-01 partial 100rb).
  await seedReceipt({ db: targetDb, now }, "rcp-seragam-01", {
    studentId: "std-aisyah-2",
    schoolId: "school-alw-1",
    amount: 100000,
    allocations: [{ kind: "seragam", orderId: "ord-demo-uso-01", amount: 100000 }],
    bankName: "BCA",
    referenceNumber: "BCA-SRG-0001",
    proofUrl: demoProofUrl("Struk BCA Seragam Aisyah"),
    autoVerify: true,
    notes: "Cicilan pertama seragam.",
  });

  // Struk pending seragam (USO-03) untuk demo tolak/verifikasi.
  await seedReceipt({ db: targetDb, now }, "rcp-seragam-02", {
    studentId: "std-farhan-3",
    schoolId: "school-alw-1",
    amount: 248000,
    allocations: [{ kind: "seragam", orderId: "ord-demo-uso-03", amount: 248000 }],
    bankName: "Mandiri",
    referenceNumber: "MND-SRG-0002",
    proofUrl: demoProofUrl("Struk Mandiri Seragam Farhan"),
    notes: "Klaim pelunasan seragam + ongkir.",
  });

  // Order seragam yang sudah dinyatakan lunas di fixture juga punya struk
  // terverifikasi, supaya total ledger = total order (bukan angka karangan).
  await seedReceipt({ db: targetDb, now }, "rcp-seragam-03", {
    studentId: "std-farhan-3",
    schoolId: "school-alw-1",
    amount: 255000,
    allocations: [{ kind: "seragam", orderId: "ord-demo-uso-02", amount: 255000 }],
    bankName: "BCA",
    referenceNumber: "BCA-SRG-0002",
    proofUrl: demoProofUrl("Struk BCA Seragam Farhan"),
    autoVerify: true,
    notes: "Pelunasan seragam + ongkir.",
  });
  await seedReceipt({ db: targetDb, now }, "rcp-seragam-04", {
    studentId: "std-alw2-01",
    schoolId: "school-alw-2",
    amount: 248000,
    allocations: [{ kind: "seragam", orderId: "ord-demo-uso-05", amount: 248000 }],
    bankName: "BNI",
    referenceNumber: "BNI-SRG-0004",
    proofUrl: demoProofUrl("Struk BNI Seragam Rania"),
    autoVerify: true,
    notes: "Pelunasan seragam cabang 2 + ongkir.",
  });

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
