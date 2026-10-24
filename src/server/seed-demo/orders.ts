import {
  bookReturns,
  paymentAllocations,
  paymentReceipts,
  studentBookOrders,
} from "../../db/schema";
import type { SeedContext } from "./context";

export async function seedOrders({ db: targetDb, now }: SeedContext) {
  // Insert per baris agar re-seed mengisi kembali order demo yang hilang.

  // Skenario 1: Aisyah (Lunas & Sudah Ambil dengan Surat Jalan)
  await targetDb.insert(studentBookOrders).values({
    id: "ord-aisyah-done",
    orderNumber: "ORD-202609-001",
    studentId: "std-aisyah-2",
    schoolId: "school-alw-1",
    packageId: "pkg-sd1-int",
    orderType: "regular",
    paymentStatus: "paid",
    fulfillmentStatus: "picked_up",
    totalAmount: 1850000,
    paidAmount: 1850000,
    handoverDeliveryNumber: "SJ-SERAH-202609-0012",
    handoverDate: now,
    handoverRecipient: "Ir. Bambang Trihatmojo (Ayah)",
    notes: "Lunas transfer BCA, diserahkan di loket logistik sekolah",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await targetDb.insert(paymentReceipts).values({
    id: "rcp-aisyah-1",
    studentId: "std-aisyah-2",
    schoolId: "school-alw-1",
    amount: 1850000,
    bankName: "BCA",
    referenceNumber: "BCA-TRX-881920",
    receivedAt: now,
    verifiedAt: now,
    notes: "Pembayaran lunas buku",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
  await targetDb.insert(paymentAllocations).values({
    id: "alc-aisyah-1",
    receiptId: "rcp-aisyah-1",
    orderId: "ord-aisyah-done",
    kind: "buku",
    amount: 1850000,
    createdAt: now,
  }).onConflictDoNothing();

  // Skenario 2: Nathaniel (Cicilan / Partial Payment)
  await targetDb.insert(studentBookOrders).values({
    id: "ord-nathan-partial",
    orderNumber: "ORD-202609-002",
    studentId: "std-nathan-4",
    schoolId: "school-alw-1",
    packageId: "pkg-sd1-nas",
    orderType: "regular",
    paymentStatus: "partial",
    fulfillmentStatus: "waiting_preparation",
    totalAmount: 950000,
    paidAmount: 500000,
    notes: "Ortu transfer gabungan SPP Rp 2.500.000 + Buku Rp 500.000 (Sisa Rp 450.000)",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await targetDb.insert(paymentReceipts).values({
    id: "rcp-nathan-1",
    studentId: "std-nathan-4",
    schoolId: "school-alw-1",
    amount: 3000000,
    bankName: "Mandiri",
    referenceNumber: "MND-TRX-551299",
    receivedAt: now,
    verifiedAt: now,
    notes: "Transfer gabungan SPP bulan Juli dan cicilan ke-1 buku paket",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
  await targetDb.insert(paymentAllocations).values({
    id: "alc-nathan-1",
    receiptId: "rcp-nathan-1",
    orderId: "ord-nathan-partial",
    kind: "buku",
    amount: 500000,
    createdAt: now,
  }).onConflictDoNothing();

  // Skenario 3: Farhan (Beasiswa 100%)
  await targetDb.insert(studentBookOrders).values({
    id: "ord-farhan-sch",
    orderNumber: "ORD-202609-003",
    studentId: "std-farhan-3",
    schoolId: "school-alw-1",
    packageId: "pkg-sd1-int",
    orderType: "scholarship",
    paymentStatus: "scholarship_pending",
    fulfillmentStatus: "waiting_preparation",
    totalAmount: 0,
    paidAmount: 0,
    scholarshipProofUrl: "/api/media/scholarships/demo-surat-beasiswa.jpg",
    notes: "Melampirkan surat rekomendasi beasiswa tahfidz Al-Qur'an 30 Juz",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  // Skenario 4: Hendra Wahyudi (Naik Kelas 2 - Unpaid)
  await targetDb.insert(studentBookOrders).values({
    id: "ord-hendra-unpaid",
    orderNumber: "ORD-202609-004",
    studentId: "std-hendra-1",
    schoolId: "school-alw-1",
    packageId: "pkg-sd2-int",
    orderType: "regular",
    paymentStatus: "unpaid",
    fulfillmentStatus: "waiting_preparation",
    totalAmount: 1950000,
    paidAmount: 0,
    notes: "Siswa naik kelas, menunggu konfirmasi pembayaran orang tua",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  // Skenario 5: Retur Buku Cacat
  await targetDb.insert(bookReturns).values({
    id: "ret-demo-1",
    orderId: "ord-aisyah-done",
    studentId: "std-aisyah-2",
    defectiveBookId: "b-math-1",
    reason: "Halaman 20 sampai 35 robek dan cetakan matematika buram tidak terbaca",
    photoProofUrl: "/api/media/returns/demo-buku-rusak.jpg",
    status: "reported",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
}
