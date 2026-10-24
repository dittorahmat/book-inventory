import { eq } from "drizzle-orm";
import {
  bookItems,
  packageItems,
  paymentAllocations,
  paymentReceipts,
  studentBookOrders,
  studentOrderItems,
  students,
} from "../../db/schema";
import { demoPackagePrice } from "./demo-books";
import type { SeedContext } from "./context";

const BRANCH_STUDENTS = [
  { id: "std-alw2-01", schoolId: "school-alw-2", nis: "2026202001", name: "Rania Putri", gender: "female" as const, gradeLevel: "2", curriculumType: "international" as const, parentName: "Ibu Rania", parentEmail: "rani.parent@gmail.com", parentPhone: "+6281200000201" },
  { id: "std-alw2-02", schoolId: "school-alw-2", nis: "2026202002", name: "Fauzan Akbar", gender: "male" as const, gradeLevel: "2", curriculumType: "international" as const, parentName: "Bapak Fauzan", parentEmail: "fauzan.parent@gmail.com", parentPhone: "+6281200000202" },
  { id: "std-alw2-03", schoolId: "school-alw-2", nis: "2026202003", name: "Daffa Ramadhan", gender: "male" as const, gradeLevel: "1", curriculumType: "national" as const, parentName: "Bapak Daffa", parentEmail: "daffa.parent@gmail.com", parentPhone: "+6281200000203" },
  { id: "std-alw3-01", schoolId: "school-alw-3", nis: "2026203001", name: "Naura Zahira", gender: "female" as const, gradeLevel: "1", curriculumType: "international" as const, parentName: "Ibu Naura", parentEmail: "naura.parent@gmail.com", parentPhone: "+6281200000301" },
  { id: "std-alw3-02", schoolId: "school-alw-3", nis: "2026203002", name: "Ilham Maulana", gender: "male" as const, gradeLevel: "1", curriculumType: "national" as const, parentName: "Bapak Ilham", parentEmail: "ilham.parent@gmail.com", parentPhone: "+6281200000302" },
  { id: "std-alw3-03", schoolId: "school-alw-3", nis: "2026203003", name: "Alya Safira", gender: "female" as const, gradeLevel: "2", curriculumType: "national" as const, parentName: "Ibu Alya", parentEmail: "alya.parent@gmail.com", parentPhone: "+6281200000303" },
  { id: "std-alw4-01", schoolId: "school-alw-4", nis: "2026204001", name: "Rizky Pratama", gender: "male" as const, gradeLevel: "2", curriculumType: "national" as const, parentName: "Bapak Rizky", parentEmail: "rizky.parent@gmail.com", parentPhone: "+6281200000401" },
  { id: "std-alw4-02", schoolId: "school-alw-4", nis: "2026204002", name: "Safiya Anindya", gender: "female" as const, gradeLevel: "1", curriculumType: "international" as const, parentName: "Ibu Safiya", parentEmail: "safiya.parent@gmail.com", parentPhone: "+6281200000402" },
  { id: "std-alw4-03", schoolId: "school-alw-4", nis: "2026204003", name: "Raka Adhitama", gender: "male" as const, gradeLevel: "1", curriculumType: "international" as const, parentName: "Bapak Adhitama", parentEmail: "adhitama.parent@gmail.com", parentPhone: "+6281200000404" },
];

const BRANCH_ITEMS = [
  { id: "bi-alw2-math-01", bookId: "b-math-2", currentSchoolId: "school-alw-2", barcode: "ALW2-MATH-001", condition: "new" as const, status: "in_stock" as const },
  { id: "bi-alw2-math-02", bookId: "b-math-2", currentSchoolId: "school-alw-2", barcode: "ALW2-MATH-002", condition: "good" as const, status: "in_stock" as const },
  { id: "bi-alw2-eng-01", bookId: "b-eng-2", currentSchoolId: "school-alw-2", barcode: "ALW2-ENG-001", condition: "fair" as const, status: "in_stock" as const },
  { id: "bi-alw2-eng-02", bookId: "b-eng-2", currentSchoolId: "school-alw-2", barcode: "ALW2-ENG-002", condition: "damaged" as const, status: "in_stock" as const },
  { id: "bi-alw2-sci-01", bookId: "b-sci-2", currentSchoolId: "school-alw-2", barcode: "ALW2-SCI-001", condition: "new" as const, status: "lost" as const },
  { id: "bi-alw2-sci-02", bookId: "b-sci-2", currentSchoolId: "school-alw-2", barcode: "ALW2-SCI-002", condition: "damaged" as const, status: "in_stock" as const, isRejected: true },
  { id: "bi-alw3-math-01", bookId: "b-math-1", currentSchoolId: "school-alw-3", barcode: "ALW3-MATH-001", condition: "new" as const, status: "in_stock" as const },
  { id: "bi-alw3-math-02", bookId: "b-math-1", currentSchoolId: "school-alw-3", barcode: "ALW3-MATH-002", condition: "good" as const, status: "in_stock" as const },
  { id: "bi-alw3-eng-01", bookId: "b-eng-1", currentSchoolId: "school-alw-3", barcode: "ALW3-ENG-001", condition: "damaged" as const, status: "in_stock" as const },
  { id: "bi-alw3-sci-01", bookId: "b-sci-1", currentSchoolId: "school-alw-3", barcode: "ALW3-SCI-001", condition: "new" as const, status: "lost" as const },
  { id: "bi-alw4-pai-01", bookId: "b-pai-2", currentSchoolId: "school-alw-4", barcode: "ALW4-PAI-001", condition: "new" as const, status: "in_stock" as const },
  { id: "bi-alw4-pai-02", bookId: "b-pai-2", currentSchoolId: "school-alw-4", barcode: "ALW4-PAI-002", condition: "fair" as const, status: "in_stock" as const },
  { id: "bi-alw4-bindo-01", bookId: "b-bindo-1", currentSchoolId: "school-alw-4", barcode: "ALW4-BINDO-001", condition: "good" as const, status: "in_stock" as const },
  { id: "bi-alw4-bindo-02", bookId: "b-bindo-1", currentSchoolId: "school-alw-4", barcode: "ALW4-BINDO-002", condition: "damaged" as const, status: "in_stock" as const },
  { id: "bi-wh-math-01", bookId: "b-math-1", currentSchoolId: "school-warehouse", barcode: "WH-MATH-001", condition: "new" as const, status: "in_stock" as const },
  { id: "bi-wh-math-02", bookId: "b-math-1", currentSchoolId: "school-warehouse", barcode: "WH-MATH-002", condition: "new" as const, status: "in_stock" as const },
  { id: "bi-wh-math-03", bookId: "b-math-1", currentSchoolId: "school-warehouse", barcode: "WH-MATH-003", condition: "new" as const, status: "in_stock" as const },
  { id: "bi-wh-eng-01", bookId: "b-eng-1", currentSchoolId: "school-warehouse", barcode: "WH-ENG-001", condition: "new" as const, status: "in_stock" as const },
  { id: "bi-wh-eng-02", bookId: "b-eng-1", currentSchoolId: "school-warehouse", barcode: "WH-ENG-002", condition: "new" as const, status: "in_stock" as const },
  { id: "bi-wh-eng-03", bookId: "b-eng-1", currentSchoolId: "school-warehouse", barcode: "WH-ENG-003", condition: "new" as const, status: "in_stock" as const },
];

const BRANCH_BUNDLES = [
  { id: "pki-alw2-sd2-01", packageId: "pkg-sd2-int", currentSchoolId: "school-alw-2", barcode: "PKG-ALW2-2026-0001" },
  { id: "pki-alw2-sd2-02", packageId: "pkg-sd2-int", currentSchoolId: "school-alw-2", barcode: "PKG-ALW2-2026-0002" },
  { id: "pki-alw3-sd1-01", packageId: "pkg-sd1-int", currentSchoolId: "school-alw-3", barcode: "PKG-ALW3-2026-0001" },
  { id: "pki-alw3-sd1-02", packageId: "pkg-sd1-int", currentSchoolId: "school-alw-3", barcode: "PKG-ALW3-2026-0002" },
  { id: "pki-alw4-sd1-01", packageId: "pkg-sd1-nas", currentSchoolId: "school-alw-4", barcode: "PKG-ALW4-2026-0001" },
  { id: "pki-alw4-sd1-02", packageId: "pkg-sd1-nas", currentSchoolId: "school-alw-4", barcode: "PKG-ALW4-2026-0002" },
];

export async function seedDemoBranches({ db: targetDb, now }: SeedContext) {
  const prices = {
    sd1Int: await demoPackagePrice({ db: targetDb, now }, "pkg-sd1-int"),
    sd1Nas: await demoPackagePrice({ db: targetDb, now }, "pkg-sd1-nas"),
    sd2Int: await demoPackagePrice({ db: targetDb, now }, "pkg-sd2-int"),
  };

  for (const student of BRANCH_STUDENTS) {
    await targetDb
      .insert(students)
      .values({
        ...student,
        academicYear: "2026/2027",
        status: "active",
        isScholarship: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  // Siswa walk-in untuk riwayat penjualan langsung gudang.
  await targetDb
    .insert(students)
    .values({
      id: "walk-in-direct-school-warehouse",
      schoolId: "school-warehouse",
      nis: "WALK-IN-DIRECT",
      name: "Walk-in Direct Sale",
      gradeLevel: "0",
      academicYear: "2026/2027",
      parentName: "Kasir Gudang",
      status: "active",
      isScholarship: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  for (const item of BRANCH_ITEMS) {
    await targetDb
      .insert(bookItems)
      .values({
        ...item,
        notes: "Stok demo cabang",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  for (const bundle of BRANCH_BUNDLES) {
    await targetDb
      .insert(packageItems)
      .values({
        ...bundle,
        status: "in_stock",
        notes: "Bundel siap serah cabang",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  // Order lunas + sudah diambil (Al Wildan 2).
  await targetDb
    .insert(studentBookOrders)
    .values({
      id: "ord-alw2-paid",
      orderNumber: "ORD-202610-201",
      studentId: "std-alw2-01",
      schoolId: "school-alw-2",
      packageId: "pkg-sd2-int",
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      totalAmount: prices.sd2Int,
      paidAmount: prices.sd2Int,
      assignedPackageItemId: "pki-alw2-sd2-01",
      handoverDeliveryNumber: "SJ-SERAH-202610-0201",
      handoverDate: now,
      handoverRecipient: "Ibu Rania",
      notes: "Lunas transfer BCA cabang 2.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: studentBookOrders.id,
      set: { totalAmount: prices.sd2Int, paidAmount: prices.sd2Int, updatedAt: now },
    });
  await targetDb
    .update(packageItems)
    .set({ status: "delivered", updatedAt: now })
    .where(eq(packageItems.id, "pki-alw2-sd2-01"));
  await targetDb
    .update(students)
    .set({ hasTakenPackage: true, packageReceivedAt: now, updatedAt: now })
    .where(eq(students.id, "std-alw2-01"));

  // Order cicilan (Al Wildan 3) + struk verified.
  await targetDb
    .insert(studentBookOrders)
    .values({
      id: "ord-alw3-partial",
      orderNumber: "ORD-202610-202",
      studentId: "std-alw3-01",
      schoolId: "school-alw-3",
      packageId: "pkg-sd1-int",
      orderType: "regular",
      paymentStatus: "partial",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: prices.sd1Int,
      paidAmount: 700000,
      notes: "Cicilan pertama Rp 700.000.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: studentBookOrders.id,
      set: { totalAmount: prices.sd1Int, updatedAt: now },
    });
  await targetDb
    .insert(paymentReceipts)
    .values({
      id: "rcp-alw3-1",
      studentId: "std-alw3-01",
      schoolId: "school-alw-3",
      amount: 700000,
      bankName: "BNI",
      referenceNumber: "BNI-ALW3-0001",
      receivedAt: now,
      verifiedAt: now,
      notes: "Cicilan pertama buku paket.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  await targetDb
    .insert(paymentAllocations)
    .values({
      id: "alc-alw3-1",
      receiptId: "rcp-alw3-1",
      orderId: "ord-alw3-partial",
      kind: "buku",
      amount: 700000,
      createdAt: now,
    })
    .onConflictDoNothing();

  // Order belum bayar (Al Wildan 4).
  await targetDb
    .insert(studentBookOrders)
    .values({
      id: "ord-alw4-unpaid",
      orderNumber: "ORD-202610-203",
      studentId: "std-alw4-01",
      schoolId: "school-alw-4",
      packageId: "pkg-sd1-nas",
      orderType: "regular",
      paymentStatus: "unpaid",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: prices.sd1Nas,
      paidAmount: 0,
      notes: "Menunggu pembayaran orang tua.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: studentBookOrders.id,
      set: { totalAmount: prices.sd1Nas, updatedAt: now },
    });

  // Riwayat penjualan langsung gudang (kasir) — kanal direct sale di laporan.
  await targetDb
    .insert(studentBookOrders)
    .values({
      id: "ord-direct-demo-1",
      orderNumber: "DIR-202610-001",
      studentId: "walk-in-direct-school-warehouse",
      schoolId: "school-warehouse",
      packageId: null,
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      totalAmount: 250000,
      paidAmount: 250000,
      handoverDate: now,
      handoverRecipient: "Ibu Rina (Walk-in)",
      notes: "Direct Sale: Ibu Rina (081200000099)",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: studentBookOrders.id,
      set: { totalAmount: 250000, paidAmount: 250000, updatedAt: now },
    });
  const directItems = [
    { id: "soi-direct-1", bookId: "b-math-1", unitPriceSnapshot: 120000 },
    { id: "soi-direct-2", bookId: "b-eng-1", unitPriceSnapshot: 130000 },
  ];
  for (const item of directItems) {
    await targetDb
      .insert(studentOrderItems)
      .values({ ...item, orderId: "ord-direct-demo-1", quantity: 1, createdAt: now })
      .onConflictDoNothing();
  }
  await targetDb
    .insert(paymentReceipts)
    .values({
      id: "rcp-direct-demo-1",
      studentId: "walk-in-direct-school-warehouse",
      schoolId: "school-warehouse",
      amount: 250000,
      bankName: "KAS TUNAI",
      referenceNumber: "DIR-202610-001",
      receivedAt: now,
      verifiedAt: now,
      notes: "Pembayaran tunai di kasir gudang.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  await targetDb
    .insert(paymentAllocations)
    .values({
      id: "alc-direct-demo-1",
      receiptId: "rcp-direct-demo-1",
      orderId: "ord-direct-demo-1",
      kind: "buku",
      amount: 250000,
      createdAt: now,
    })
    .onConflictDoNothing();
  await targetDb
    .update(bookItems)
    .set({ status: "sold", updatedAt: now })
    .where(eq(bookItems.id, "bi-wh-math-01"));
  await targetDb
    .update(bookItems)
    .set({ status: "sold", updatedAt: now })
    .where(eq(bookItems.id, "bi-wh-eng-01"));
}
