import { inArray, eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { db } from "../../db";
import {
  students,
  studentBookOrders,
  studentOrderItems,
  orderPayments,
  bookPackages,
  books,
} from "../../db/schema";
import { defaultStorage } from "../../services/storage";
import { decodeBase64ToBytes } from "../base64";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { getCurrentSatuanStatus } from "./satuan-cutoff";
import {
  derivePaymentStatus,
  grossOrderAmount,
  validateSatuanCutoff,
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
 * Deep module untuk proses order intake publik (regular atau beasiswa 100%).
 * Mengenkapsulasi verifikasi siswa, cutoff order satuan, hitungan harga,
 * penyimpanan bukti di storage, serta pembuatan entitas order atomik.
 */
export async function submitPublicOrder(
  input: SubmitPublicOrderInput
): Promise<SubmitPublicOrderResult> {
  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

  // 1. Verifikasi siswa (aturan murni)
  const [studentRow] = await db.select().from(students).where(eq(students.id, input.studentId));
  const studentCheck = validateStudentForOrder(studentRow);
  if (!studentCheck.ok) return studentCheck;
  const student = studentCheck.student;

  // 2. Validasi cutoff order satuan (aturan murni)
  const looseItems = input.looseItems ?? [];
  if (looseItems.length > 0) {
    const cutoffCheck = validateSatuanCutoff(true, await getCurrentSatuanStatus());
    if (!cutoffCheck.ok) return cutoffCheck;
  }

  // 3. Resolusi paket buku jika dipilih
  let pkg: typeof bookPackages.$inferSelect | undefined;
  if (input.packageId) {
    [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, input.packageId));
    if (!pkg) {
      return { ok: false, status: 404, message: "Paket buku tidak ditemukan" };
    }
  }

  // 4. Baris buku satuan: ambil harga jual efektif
  const looseLines: Array<{ bookId: string; title: string; quantity: number; unitPrice: number }> = [];
  if (looseItems.length > 0) {
    const bookIds = [...new Set(looseItems.map((i) => i.bookId))];
    const bookRows: Array<typeof books.$inferSelect> = await db.select().from(books).where(inArray(books.id, bookIds));
    const bookMap = new Map<string, typeof books.$inferSelect>(bookRows.map((b) => [b.id, b]));

    for (const item of looseItems) {
      const book = bookMap.get(item.bookId);
      if (!book) {
        return { ok: false, status: 404, message: "Judul buku tidak ditemukan" };
      }
      looseLines.push({
        bookId: book.id,
        title: book.title,
        quantity: item.quantity,
        unitPrice: effectiveSellPrice(book),
      });
    }
  }

  // 5. Bukti beasiswa
  const isScholarship = input.orderType === "scholarship";
  let scholarshipProofUrl: string | null = null;
  if (isScholarship) {
    if (!input.scholarshipProofBase64) {
      return { ok: false, status: 400, message: "Surat tanda beasiswa wajib dilampirkan" };
    }
    const key = `scholarships/${student.id}_${Date.now()}.jpg`;
    const buffer = decodeBase64ToBytes(input.scholarshipProofBase64);
    scholarshipProofUrl = await defaultStorage.upload(key, buffer, "image/jpeg");
  }

  // 6. Hitung nominal order dan status pembayaran (aturan murni)
  const grossAmount = grossOrderAmount(pkg?.price ?? 0, looseLines);
  const { totalAmount, paidAmount, paymentStatus } = derivePaymentStatus({
    isScholarship,
    grossAmount,
    bookAllocationAmount: !isScholarship && input.payment ? input.payment.bookAllocationAmount : 0,
  });

  // 7. Simpan entitas order utama
  await db.insert(studentBookOrders).values({
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
  });

  // 8. Simpan baris pesanan satuan
  for (const line of looseLines) {
    await db.insert(studentOrderItems).values({
      id: crypto.randomUUID(),
      orderId,
      bookId: line.bookId,
      quantity: line.quantity,
      unitPriceSnapshot: line.unitPrice,
      createdAt: now,
    });
  }

  // 9. Simpan bukti transfer jika ada
  if (!isScholarship && input.payment && input.payment.bookAllocationAmount > 0) {
    let paymentProofUrl: string | null = null;
    if (input.payment.paymentProofBase64) {
      const key = `payments/${orderId}_${Date.now()}.jpg`;
      const buffer = decodeBase64ToBytes(input.payment.paymentProofBase64);
      paymentProofUrl = await defaultStorage.upload(key, buffer, "image/jpeg");
    }

    await db.insert(orderPayments).values({
      id: crypto.randomUUID(),
      orderId,
      transferAmount: input.payment.transferAmount,
      bookAllocationAmount: input.payment.bookAllocationAmount,
      paymentProofUrl,
      bankName: input.payment.bankName || null,
      referenceNumber: input.payment.referenceNumber || null,
      notes: "Submitted via Public Form",
      createdAt: now,
    });
  }

  const [orderRecord] = await db
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
