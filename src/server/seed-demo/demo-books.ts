import { eq } from "drizzle-orm";
import {
  bookPackages,
  packageItems,
  paymentAllocations,
  paymentReceipts,
  studentBookOrders,
  students,
} from "../../db/schema";
import type { SeedContext } from "./context";

/** Harga paket tersimpan (BOM + WPR) — dipakai lintas fixture demo. */
export async function demoPackagePrice(ctx: SeedContext, packageId: string): Promise<number> {
  const [row] = await ctx.db
    .select({ price: bookPackages.price })
    .from(bookPackages)
    .where(eq(bookPackages.id, packageId));
  return row?.price ?? 0;
}

/**
 * Fondasi order buku: nominal mengikuti harga paket, dan penyerahan Aisyah
 * konsisten secara fisik (bundel ter-assign + status siswa).
 */
export async function seedDemoBooks({ db: targetDb, now }: SeedContext) {
  const sd1Int = await demoPackagePrice({ db: targetDb, now }, "pkg-sd1-int");
  const sd1Nas = await demoPackagePrice({ db: targetDb, now }, "pkg-sd1-nas");
  const sd2Int = await demoPackagePrice({ db: targetDb, now }, "pkg-sd2-int");

  await targetDb
    .update(studentBookOrders)
    .set({ totalAmount: sd1Int, paidAmount: sd1Int, updatedAt: now })
    .where(eq(studentBookOrders.id, "ord-aisyah-done"));
  await targetDb
    .update(paymentReceipts)
    .set({ amount: sd1Int, updatedAt: now })
    .where(eq(paymentReceipts.id, "rcp-aisyah-1"));
  await targetDb
    .update(paymentAllocations)
    .set({ amount: sd1Int })
    .where(eq(paymentAllocations.id, "alc-aisyah-1"));

  await targetDb
    .update(studentBookOrders)
    .set({ totalAmount: sd1Nas, updatedAt: now })
    .where(eq(studentBookOrders.id, "ord-nathan-partial"));

  await targetDb
    .update(studentBookOrders)
    .set({ totalAmount: sd2Int, updatedAt: now })
    .where(eq(studentBookOrders.id, "ord-hendra-unpaid"));

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
}
