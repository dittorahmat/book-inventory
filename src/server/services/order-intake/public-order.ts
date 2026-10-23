import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import {
  students,
  studentBookOrders,
  studentOrderItems,
  bookPackages,
} from "../../../db/schema";
import { defaultStorage, type StorageService } from "../../../services/storage";
import { decodeBase64ToBytes } from "../../base64";
import type { SatuanStatus } from "../../../lib/portal-types";
import { getCurrentSatuanStatus } from "./cutoff";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { documentNumber, epochTimeFragment } from "../../lib/document-number";
import { validateHomeAddress } from "../../../lib/home-address";
import { WPR_BOOK_ID, WPR_TITLE } from "../../../lib/wpr";
import { ensureWprBook } from "../wpr";
import { emitChargeQuery } from "../branch-charges";
import { wprFeeForStudent } from "../pricing";
import { buildReceiptDraft, receiptNumberConflict, receiptWriteQueries } from "../payment-ledger";
import { reserveLooseLines, resolveLooseLines } from "./intake";
import {
  derivePaymentStatus,
  grossOrderAmount,
  validateOrderLines,
  validatePackageForOrder,
  validateSatuanCutoff,
  validatePaymentProof,
  validateScholarshipProof,
  validateStudentForOrder,
} from "./validation";

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
  /** Wajib bila ada looseItems (kirim-rumah satuan ala seragam). */
  homeAddress?: string;
  orderType: "regular" | "scholarship";
  scholarshipProofBase64?: string;
  financeProofBase64?: string;
  parentPhoneManual?: string;
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
        wprCharged: boolean;
      };
    }
  | {
      ok: false;
      status: ContentfulStatusCode;
      message: string;
    };

/**
 * Seam injeksi intake publik: database + storage diterima sebagai dependensi,
 * penomoran/ID/jam/status satuan dapat diinjeksi agar test deterministik
 * tanpa upload jaringan.
 */
export interface SubmitPublicOrderDeps {
  database: AppDatabase;
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
  deps: SubmitPublicOrderDeps
): Promise<SubmitPublicOrderResult> {
  const database: AppDatabase = deps.database;
  const storage: StorageService = deps.storage ?? defaultStorage;
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const orderId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const orderNumber = (deps.generateOrderNumber ?? (() => documentNumber("ORD", epochTimeFragment(Date.now(), 8))))(now);
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
    const cutoffCheck = validateSatuanCutoff(true, await (deps.getSatuanStatus ?? (() => getCurrentSatuanStatus(database)))());
    if (!cutoffCheck.ok) return cutoffCheck;
    const addressCheck = validateHomeAddress(input.homeAddress);
    if (!addressCheck.ok) return { ok: false, status: 400, message: addressCheck.message as string };
  } else if (input.homeAddress?.trim()) {
    // Paket kirim-rumah: alamat opsional tetapi bila diisi wajib lengkap.
    const addressCheck = validateHomeAddress(input.homeAddress);
    if (!addressCheck.ok) return { ok: false, status: 400, message: addressCheck.message as string };
  }

  // 3. Resolusi paket buku jika dipilih (aturan murni)
  let pkg: typeof bookPackages.$inferSelect | undefined;
  if (input.packageId) {
    [pkg] = await database.select().from(bookPackages).where(eq(bookPackages.id, input.packageId));
  }
  const pkgCheck = validatePackageForOrder(pkg, input.packageId);
  if (!pkgCheck.ok) return pkgCheck;

  // 4. Baris buku satuan: resolusi harga + validasi judul via modul intake bersama.
  const resolved = await resolveLooseLines(database, looseItems);
  if (!resolved.ok) return resolved;
  const looseLines = resolved.lines;

  // 5. Bukti beasiswa atau bukti transfer pembayaran (aturan murni)
  const isScholarship = input.orderType === "scholarship";
  const scholarshipCheck = validateScholarshipProof(isScholarship, input.scholarshipProofBase64);
  if (!scholarshipCheck.ok) return scholarshipCheck;
  const paymentProofCheck = validatePaymentProof(!isScholarship, input.payment?.paymentProofBase64);
  if (!paymentProofCheck.ok) return paymentProofCheck;

  // 6. Reservasi kuantitas satuan via modul intake bersama SEBELUM upload bukti.
  // WPR bukan stok fisik: tidak direservasi, ditambahkan sebagai baris biaya sesudahnya.
  const reserved = await reserveLooseLines(database, student.schoolId, looseLines);
  if (!reserved.ok) return { ok: false, status: reserved.status, message: reserved.message };

  // 6b. WPR wajib untuk satuan tanpa order paket (reguler maupun beasiswa).
  let wprCharged = false;
  if (looseLines.length > 0) {
    await ensureWprBook(database);
    const wprFee = await wprFeeForStudent(database, student.id);
    if (wprFee > 0) {
      looseLines.push({ bookId: WPR_BOOK_ID, title: WPR_TITLE, quantity: 1, unitPrice: wprFee });
      wprCharged = true;
    }
  }

  // 7. Hitung nominal order dan status pembayaran (aturan murni).
  // Klaim bukti orang tua tidak menambah terbayar: `unpaid`/`scholarship_pending`
  // sampai staf gudang memverifikasi baris pembayaran.
  const grossAmount = grossOrderAmount(pkg?.price ?? 0, looseLines);
  const { totalAmount, paidAmount, paymentStatus } = derivePaymentStatus({
    isScholarship,
    grossAmount,
  });

  // 7b. Bentuk struk SEBELUM efek samping: validasi nominal + alokasi terjadi
  // sebelum upload bukti, sehingga 400 tidak meninggalkan objek yatim. Baris
  // struk tetap milik kernel ledger (ADR-0012), bukan dirakit di sini.
  const needsPayment = !isScholarship && !!input.payment && input.payment.bookAllocationAmount > 0;
  const receiptId = needsPayment ? genPaymentId() : null;
  const receiptDraft =
    receiptId === null
      ? null
      : buildReceiptDraft(
          {
            studentId: student.id,
            schoolId: student.schoolId,
            amount: input.payment?.transferAmount ?? 0,
            allocations: [
              {
                orderId,
                kind: "buku",
                amount: input.payment?.bookAllocationAmount ?? 0,
                billAmount: totalAmount,
              },
            ],
            bankName: input.payment?.bankName,
            referenceNumber: input.payment?.referenceNumber,
            notes: "Submitted via Public Form",
          },
          now,
          receiptId,
          { allocationId: () => `alc-${receiptId}` }
        );
  if (receiptDraft && !receiptDraft.ok) return receiptDraft;

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

    let financeProofUrl: string | null = null;
    if (input.financeProofBase64) {
      const key = `finance_letters/${orderId}_${Date.now()}.jpg`;
      financeProofUrl = await storage.upload(
        key,
        decodeBase64ToBytes(input.financeProofBase64),
        "image/jpeg"
      );
      uploadedKeys.push(key);
    }
    if (receiptDraft?.ok) receiptDraft.draft.receipt.proofUrl = paymentProofUrl;

    const itemRows = looseLines.map((line) => ({
      id: genItemId(),
      orderId,
      bookId: line.bookId,
      quantity: line.quantity,
      unitPriceSnapshot: line.unitPrice,
      createdAt: now,
    }));

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
        homeAddressSnapshot: input.homeAddress?.trim() ? input.homeAddress.trim() : null,
        satuanShipmentStatus: "belum_dikirim",
        scholarshipProofUrl,
        financeProofUrl,
        parentPhoneManual: input.parentPhoneManual?.trim() || null,
        notes: input.notes || null,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(itemRows).map((rows) => database.insert(studentOrderItems).values(rows)),
      ...(receiptDraft?.ok ? receiptWriteQueries(database, receiptDraft.draft) : []),
      // Buku satuan dikirim dari gudang → ditagihkan ke cabang sejak order dibuat.
      // Paket murni baru ditagih saat serah-terima (lihat order-handover).
      ...(looseLines.length > 0
        ? [
            emitChargeQuery(database, {
              schoolId: student.schoolId,
              sourceType: "book_order",
              sourceId: orderId,
              triggerEvent: "order_created",
              goodsAmount: totalAmount,
            }),
          ]
        : []),
    ]);
  } catch (err) {
    await compensateUploads();
    if (receiptNumberConflict(err)) {
      return {
        ok: false,
        status: 409,
        message: "Bukti transfer dengan bank + nomor referensi ini sudah pernah dicatat.",
      };
    }
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
      wprCharged,
    },
  };
}
