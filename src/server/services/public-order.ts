import { inArray, eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { db, type AppDatabase } from "../../db";
import {
  students,
  studentBookOrders,
  studentOrderItems,
  orderPayments,
  bookPackages,
  books,
} from "../../db/schema";
import { defaultStorage, type StorageService } from "../../services/storage";
import { decodeBase64ToBytes } from "../base64";
import { effectiveSellPrice } from "../../lib/book-pricing";
import type { SatuanStatus } from "../../lib/portal-types";
import { getCurrentSatuanStatus } from "./satuan-cutoff";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { allocateLooseStock } from "./stock-allocation";
import {
  derivePaymentStatus,
  grossOrderAmount,
  validateLooseBooks,
  validateOrderLines,
  validatePackageForOrder,
  validateSatuanCutoff,
  validateScholarshipProof,
  validateStudentForOrder,
} from "./order-validation";

export interface LooseOrderItemInput {
  bookId: string;
  quantity: number;
}

export interface PaymentSubmissionInput {
  transferAmount: number;
  bookAllocationAmount: number;
  bankName?: string;
  referenceNumber?: string;
  paymentProofBase64?: string;
}

export interface SubmitPublicOrderInput {
  studentId: string;
  packageId?: string;
  looseItems?: LooseOrderItemInput[];
  orderType: "regular" | "scholarship";
  scholarshipProofBase64?: string;
  payment?: PaymentSubmissionInput;
  notes?: string;
}

export type SubmitPublicOrderResult =
  | {
      ok: true;
      data: {
        order: typeof studentBookOrders.$inferSelect;
        studentName: string;
        packageName: string | null;
        looseItems: Array<{ bookId: string; title: string; quantity: number; unitPrice: number }>;
        totalAmount: number;
        paidAmount: number;
        paymentStatus: string;
      };
    }
  | {
      ok: false;
      status: ContentfulStatusCode;
      message: string;
    };

/**
 * Seam injeksi intake publik: database + storage diterima sebagai dependensi
 * (default global agar pemanggil lama `submitPublicOrder(input)` tetap jalan),
 * penomoran/ID/jam/status satuan dapat diinjeksi agar test deterministik
 * tanpa upload jaringan.
 */
export interface SubmitPublicOrderDeps {
  database?: AppDatabase;
  storage?: StorageService;
  now?: () => string;
  generateId?: () => string;
  generateOrderNumber?: (nowIso: string) => string;
  generateItemId?: () => string;
  generatePaymentId?: () => string;
  getSatuanStatus?: () => Promise<SatuanStatus>;
}

/**
 * Deep module untuk proses order intake publik (regular atau beasiswa 100%).
 * Urutan disiplin: validasi murni (order-validation) → reservasi kuantitas
 * satuan via seam alokasi → upload bukti ke storage → satu batch tulis atomik
 * (order + item + payment, chunk maksimal 10 via seam lib/d1-write).
 * Upload terjadi SETELAH reservasi; bila tulis gagal setelah upload, objek
 * yang sudah terunggah dikompensasi (dihapus) agar tidak yatim.
 * Bundel paket tidak direservasi di intake — bundel fisik ditetapkan saat
 * serah terima (handover), bukan saat orang tua submit.
 */
export async function submitPublicOrder(
  input: SubmitPublicOrderInput,
  deps: SubmitPublicOrderDeps = {}
): Promise<SubmitPublicOrderResult> {
  const database: AppDatabase = deps.database ?? db;
  const storage: StorageService = deps.storage ?? defaultStorage;
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const orderId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const orderNumber = (deps.generateOrderNumber ?? (() => `ORD-${Date.now().toString().slice(-8)}`))(now);
  const genItemId = deps.generateItemId ?? (() => crypto.randomUUID());
  const genPaymentId = deps.generatePaymentId ?? (() => crypto.randomUUID());

  // 0. Bentuk order (aturan murni)
  const linesCheck = validateOrderLines(input.packageId, input.looseItems);
  if (!linesCheck.ok) return linesCheck;

  // 1. Verifikasi siswa (aturan murni)
  const [studentRow] = await database.select().from(students).where(eq(students.id, input.studentId));
  const studentCheck = validateStudentForOrder(studentRow);
  if (!studentCheck.ok) return studentCheck;
  const student = studentCheck.student;

  // 2. Validasi cutoff order satuan (aturan murni; status dapat diinjeksi di test)
  const looseItems = input.looseItems ?? [];
  if (looseItems.length > 0) {
    const cutoffCheck = validateSatuanCutoff(true, await (deps.getSatuanStatus ?? getCurrentSatuanStatus)());
    if (!cutoffCheck.ok) return cutoffCheck;
  }

  // 3. Resolusi paket buku jika dipilih (aturan murni)
  let pkg: typeof bookPackages.$inferSelect | undefined;
  if (input.packageId) {
    [pkg] = await database.select().from(bookPackages).where(eq(bookPackages.id, input.packageId));
  }
  const pkgCheck = validatePackageForOrder(pkg, input.packageId);
  if (!pkgCheck.ok) return pkgCheck;

  // 4. Baris buku satuan: ambil harga jual efektif (aturan murni)
  const bookIds = [...new Set(looseItems.map((i) => i.bookId))];
  const bookRows: Array<typeof books.$inferSelect> =
    bookIds.length > 0
      ? await database.select().from(books).where(inArray(books.id, bookIds))
      : [];
  const booksCheck = validateLooseBooks(bookIds, new Set(bookRows.map((b) => b.id)));
  if (!booksCheck.ok) return booksCheck;
  const bookMap = new Map<string, typeof books.$inferSelect>(bookRows.map((b) => [b.id, b]));
  const looseLines = looseItems.map((item) => {
    const book = bookMap.get(item.bookId);
    return {
      bookId: item.bookId,
      title: book?.title ?? "",
      quantity: item.quantity,
      unitPrice: effectiveSellPrice(book ?? { price: 0 }),
    };
  });

  // 5. Bukti beasiswa (aturan murni)
  const isScholarship = input.orderType === "scholarship";
  const scholarshipCheck = validateScholarshipProof(isScholarship, input.scholarshipProofBase64);
  if (!scholarshipCheck.ok) return scholarshipCheck;

  // 6. Reservasi kuantitas satuan via seam alokasi SEBELUM upload bukti.
  for (const line of looseLines) {
    const reservation = await allocateLooseStock(
      { bookId: line.bookId, schoolId: student.schoolId, quantity: line.quantity },
      database
    );
    if (!reservation.ok) return { ok: false, status: reservation.status, message: reservation.message };
  }

  // 7. Hitung nominal order dan status pembayaran (aturan murni)
  const grossAmount = grossOrderAmount(pkg?.price ?? 0, looseLines);
  const { totalAmount, paidAmount, paymentStatus } = derivePaymentStatus({
    isScholarship,
    grossAmount,
    bookAllocationAmount: !isScholarship && input.payment ? input.payment.bookAllocationAmount : 0,
  });

  // 8. Upload bukti setelah reservasi + tulis batch atomik; kompensasi orphan
  // bila tulis gagal setelah upload (best-effort delete, tanpa Promise.all tulis).
  const uploadedKeys: string[] = [];
  const compensateUploads = async (): Promise<void> => {
    for (const key of uploadedKeys) {
      try {
        await storage.delete(key);
      } catch {
        // Kompensasi best-effort: kegagalan hapus tidak menutupi error asli.
      }
    }
  };

  try {
    let scholarshipProofUrl: string | null = null;
    if (isScholarship && input.scholarshipProofBase64) {
      const key = `scholarships/${student.id}_${Date.now()}.jpg`;
      scholarshipProofUrl = await storage.upload(
        key,
        decodeBase64ToBytes(input.scholarshipProofBase64),
        "image/jpeg"
      );
      uploadedKeys.push(key);
    }

    const needsPayment = !isScholarship && !!input.payment && input.payment.bookAllocationAmount > 0;
    let paymentProofUrl: string | null = null;
    if (needsPayment && input.payment?.paymentProofBase64) {
      const key = `payments/${orderId}_${Date.now()}.jpg`;
      paymentProofUrl = await storage.upload(
        key,
        decodeBase64ToBytes(input.payment.paymentProofBase64),
        "image/jpeg"
      );
      uploadedKeys.push(key);
    }

    const itemRows = looseLines.map((line) => ({
      id: genItemId(),
      orderId,
      bookId: line.bookId,
      quantity: line.quantity,
      unitPriceSnapshot: line.unitPrice,
      createdAt: now,
    }));
    const paymentRows = needsPayment
      ? [
          {
            id: genPaymentId(),
            orderId,
            transferAmount: input.payment?.transferAmount ?? 0,
            bookAllocationAmount: input.payment?.bookAllocationAmount ?? 0,
            paymentProofUrl,
            bankName: input.payment?.bankName || null,
            referenceNumber: input.payment?.referenceNumber || null,
            notes: "Submitted via Public Form",
            createdAt: now,
          },
        ]
      : [];

    await runWriteBatch(database, [
      database.insert(studentBookOrders).values({
        id: orderId,
        orderNumber,
        studentId: student.id,
        schoolId: student.schoolId,
        packageId: pkg?.id ?? null,
        orderType: input.orderType,
        paymentStatus,
        fulfillmentStatus: "waiting_preparation",
        totalAmount,
        paidAmount,
        scholarshipProofUrl,
        notes: input.notes || null,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(itemRows).map((rows) => database.insert(studentOrderItems).values(rows)),
      ...paymentRows.map((row) => database.insert(orderPayments).values(row)),
    ]);
  } catch (err) {
    await compensateUploads();
    const mapped = d1WriteErrorStatus(err, "pembuatan order publik");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const [orderRecord] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, orderId));

  return {
    ok: true,
    data: {
      order: orderRecord,
      studentName: student.name,
      packageName: pkg?.name ?? null,
      looseItems: looseLines,
      totalAmount,
      paidAmount,
      paymentStatus,
    },
  };
}
