import type { AppDatabase } from "../db";
import { studentBookOrders, students, studentOrderItems, bookPackageItems, bookPackages } from "../db/schema";
import { moveInventoryStock } from "./services/stock";
import { matchStudentToBookPackage, type BookPackageRecord } from "./services/student-package-matcher";
import { runWriteBatch, writeNow, type WriteDeps, d1WriteErrorStatus } from "./lib/d1-write";
import { eq, inArray } from "drizzle-orm";

export interface GenerateSdOrdersOptions {
  schoolId?: string;
  academicYear?: string;
  handoverRecipient?: string;
}

export interface GenerateSdOrdersResult {
  ordersCreated: number;
  studentsUpdated: number;
  booksDistributed: number;
  totalOrderAmount: number;
}

/**
 * Seam Kanonik Generator Pesanan & Serah Terima Buku Murid SD AW-1 (§0.4, §0.20, §0.62)
 * Membuat order berstatus 'paid' & 'picked_up', mengupdate status siswa hasTakenPackage=true,
 * dan mengurangi saldo fisik buku cabang AW-1 secara atomik.
 */
export async function generateSdStudentOrdersAndHandover(
  database: AppDatabase,
  options: GenerateSdOrdersOptions = {},
  deps?: WriteDeps
): Promise<GenerateSdOrdersResult> {
  const schoolId = options.schoolId || "school-alw-1";
  const academicYear = options.academicYear || "2026/2027";
  const recipient = options.handoverRecipient || "Wali Murid / Siswa";
  const now = writeNow(deps);

  // 1. Ambil data siswa SD yang aktif di cabang
  const studentRows = await database
    .select()
    .from(students)
    .where(eq(students.schoolId, schoolId));

  const sdStudents = studentRows.filter((s) => ["1", "2", "3", "4", "5", "6"].includes(s.gradeLevel));
  if (sdStudents.length === 0) {
    return {
      ordersCreated: 0,
      studentsUpdated: 0,
      booksDistributed: 0,
      totalOrderAmount: 0,
    };
  }

  // 2. Ambil paket buku dan BOM
  const packages = await database
    .select()
    .from(bookPackages)
    .where(eq(bookPackages.academicYear, academicYear));

  const packageMap = new Map(packages.map((p) => [p.id, p]));
  const pkgRecords: BookPackageRecord[] = packages.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    gradeLevel: p.gradeLevel,
    curriculumType: p.curriculumType,
    intakeType: p.intakeType,
    academicYear: p.academicYear,
    price: p.price,
  }));

  const packageIds = packages.map((p) => p.id);
  const allBomItems =
    packageIds.length > 0
      ? await database
          .select()
          .from(bookPackageItems)
          .where(inArray(bookPackageItems.packageId, packageIds))
      : [];

  const bomByPackage = new Map<string, Array<{ bookId: string; quantity: number }>>();
  for (const bpi of allBomItems) {
    const list = bomByPackage.get(bpi.packageId) || [];
    list.push({ bookId: bpi.bookId, quantity: bpi.quantity });
    bomByPackage.set(bpi.packageId, list);
  }

  // 3. Bangun pesanan, serah-terima, dan akumulasi pergerakan stok
  let ordersCount = 0;
  let totalAmount = 0;
  let totalBooks = 0;
  const bookMovements = new Map<string, number>();

  const newOrders: Array<typeof studentBookOrders.$inferInsert> = [];
  const newOrderItems: Array<typeof studentOrderItems.$inferInsert> = [];
  const studentIdsToUpdate: string[] = [];

  for (let i = 0; i < sdStudents.length; i++) {
    const s = sdStudents[i];
    const pkg = matchStudentToBookPackage(
      {
        gradeLevel: s.gradeLevel,
        curriculumType: s.curriculumType,
        intakeType: s.intakeType,
        academicYear,
      },
      pkgRecords
    );

    if (!pkg) continue;

    const orderId = `ord-aw1-sd-${s.id.slice(0, 12)}`;
    const orderNumber = `ORD-AW1-2026-${String(i + 1).padStart(4, "0")}`;
    const deliveryNumber = `SJ-SERAH-AW1-2026-${String(i + 1).padStart(4, "0")}`;
    const fullPkg = packageMap.get(pkg.id)!;

    newOrders.push({
      id: orderId,
      orderNumber,
      studentId: s.id,
      schoolId,
      packageId: pkg.id,
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      totalAmount: fullPkg.price,
      paidAmount: fullPkg.price,
      handoverDeliveryNumber: deliveryNumber,
      handoverDate: now,
      handoverRecipient: recipient,
      notes: "Alokasi serah terima awal tahun ajaran 2026/2027",
      createdAt: now,
      updatedAt: now,
    });

    studentIdsToUpdate.push(s.id);
    ordersCount++;
    totalAmount += fullPkg.price;

    const boms = bomByPackage.get(pkg.id) || [];
    for (const item of boms) {
      newOrderItems.push({
        id: crypto.randomUUID(),
        orderId,
        bookId: item.bookId,
        quantity: item.quantity,
        unitPriceSnapshot: 0,
        createdAt: now,
      });

      totalBooks += item.quantity;
      bookMovements.set(item.bookId, (bookMovements.get(item.bookId) || 0) + item.quantity);
    }
  }

  // 4. Batch insert pesanan dan update siswa
  try {
    const CHUNK_SIZE = 40;
    for (let c = 0; c < newOrders.length; c += CHUNK_SIZE) {
      const orderChunk = newOrders.slice(c, c + CHUNK_SIZE);
      const studentChunk = studentIdsToUpdate.slice(c, c + CHUNK_SIZE);
      await runWriteBatch(database, [
        database.insert(studentBookOrders).values(orderChunk),
        database
          .update(students)
          .set({ hasTakenPackage: true, packageReceivedAt: now, updatedAt: now })
          .where(inArray(students.id, studentChunk)),
      ]);
    }

    for (let ci = 0; ci < newOrderItems.length; ci += 80) {
      const itemChunk = newOrderItems.slice(ci, ci + 80);
      await runWriteBatch(database, [database.insert(studentOrderItems).values(itemChunk)]);
    }

    // 5. Potong saldo stok buku cabang AW-1 secara terpadu lewat moveInventoryStock (§0.62)
    for (const [bookId, quantity] of bookMovements.entries()) {
      await moveInventoryStock(
        database,
        {
          movementType: "handover",
          itemType: "loose",
          bookId,
          schoolId,
          quantity,
          notes: `Serah terima paket SD TA 2026/2027`,
        },
        deps
      );
    }
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pembuatan order serah terima");
    if (mapped) throw new Error(mapped.message);
    throw err;
  }

  return {
    ordersCreated: ordersCount,
    studentsUpdated: studentIdsToUpdate.length,
    booksDistributed: totalBooks,
    totalOrderAmount: totalAmount,
  };
}
