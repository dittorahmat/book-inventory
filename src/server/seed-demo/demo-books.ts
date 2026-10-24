import { eq } from "drizzle-orm";
import { WPR_BOOK_ID, WPR_PRICE } from "../../lib/wpr";
import {
  bookPackages,
  packageItems,
  studentBookOrders,
  studentOrderItems,
  students,
} from "../../db/schema";
import type { SeedContext } from "./context";
import { seedReceipt } from "./receipt";

/** Harga paket tersimpan (BOM + WPR) — dipakai lintas fixture demo. */
export async function demoPackagePrice(ctx: SeedContext, packageId: string): Promise<number> {
  const [row] = await ctx.db
    .select({ price: bookPackages.price })
    .from(bookPackages)
    .where(eq(bookPackages.id, packageId));
  return row?.price ?? 0;
}

/**
 * Fondasi order buku: penyerahan Aisyah konsisten secara fisik (bundel
 * ter-assign + status siswa). Nominal baseline sudah dihitung dari harga paket.
 */
export async function seedDemoBooks({ db: targetDb, now }: SeedContext) {
  const sd2Int = await demoPackagePrice({ db: targetDb, now }, "pkg-sd2-int");

  await targetDb
    .update(packageItems)
    .set({ status: "delivered", updatedAt: now })
    .where(eq(packageItems.id, "pki-sd1int-0"));
  await targetDb
    .update(studentBookOrders)
    .set({ assignedPackageItemId: "pki-sd1int-0", updatedAt: now })
    .where(eq(studentBookOrders.id, "ord-aisyah-done"));
  await targetDb
    .update(students)
    .set({ hasTakenPackage: true, packageReceivedAt: now, updatedAt: now })
    .where(eq(students.id, "std-aisyah-2"));

  // Murid baru menunggu verifikasi NIS (antrean Data Siswa).
  await targetDb
    .insert(students)
    .values({
      id: "std-zaidan-pending",
      schoolId: "school-alw-1",
      nis: "REG-DEMO-ZAIDAN",
      name: "Zaidan Faris",
      gender: "male",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      parentName: "Faris Abdullah",
      parentEmail: "faris@example.com",
      parentPhone: "+6281234567890",
      status: "new_pending",
      isScholarship: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: students.id,
      set: { status: "new_pending", nis: "REG-DEMO-ZAIDAN", updatedAt: now },
    });

  // Order lunas menunggu serah-terima (bahan demo handover, bukan Aisyah).
  await targetDb
    .insert(studentBookOrders)
    .values({
      id: "ord-kayla-paid",
      orderNumber: "ORD-202610-101",
      studentId: "std-kayla-5",
      schoolId: "school-alw-1",
      packageId: "pkg-sd2-int",
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: sd2Int,
      paidAmount: sd2Int,
      notes: "Lunas transfer BCA, siap diserahkan di loket logistik.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: studentBookOrders.id,
      set: { totalAmount: sd2Int, paidAmount: sd2Int, paymentStatus: "paid", updatedAt: now },
    });
  await seedReceipt({ db: targetDb, now }, "rcp-kayla-1", {
    studentId: "std-kayla-5",
    schoolId: "school-alw-1",
    amount: sd2Int,
    allocations: [{ kind: "buku", orderId: "ord-kayla-paid", amount: sd2Int }],
    bankName: "BCA",
    referenceNumber: "BCA-KYL-0001",
    autoVerify: true,
    notes: "Pelunasan paket Kelas 2 Internasional.",
  });

  // Order satuan + WPR (Salsabila belum punya order paket).
  const looseItems = [
    { id: "soi-demo-loose-1", bookId: "b-eng-1", quantity: 1, unitPriceSnapshot: 130000 },
    { id: "soi-demo-loose-2", bookId: "b-math-1", quantity: 1, unitPriceSnapshot: 120000 },
    { id: "soi-demo-loose-3", bookId: WPR_BOOK_ID, quantity: 1, unitPriceSnapshot: WPR_PRICE },
  ];
  const looseTotal = looseItems.reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0);
  await targetDb
    .insert(studentBookOrders)
    .values({
      id: "ord-salsa-loose",
      orderNumber: "ORD-202610-102",
      studentId: "std-salsa-7",
      schoolId: "school-alw-1",
      packageId: null,
      orderType: "regular",
      paymentStatus: "unpaid",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: looseTotal,
      paidAmount: 0,
      homeAddressSnapshot: "Jl. Melati No. 12, RT 03 RW 04, Depok, Jawa Barat 16411",
      satuanShipmentStatus: "belum_dikirim",
      notes: "Pesanan satuan: 2 buku + WPR 750rb, kirim ke rumah.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: studentBookOrders.id,
      set: { totalAmount: looseTotal, updatedAt: now },
    });

  for (const item of looseItems) {
    await targetDb
      .insert(studentOrderItems)
      .values({ ...item, orderId: "ord-salsa-loose", createdAt: now })
      .onConflictDoUpdate({
        target: studentOrderItems.id,
        set: { quantity: item.quantity, unitPriceSnapshot: item.unitPriceSnapshot },
      });
  }
}
