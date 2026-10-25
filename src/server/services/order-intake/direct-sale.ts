import { and, eq, inArray, sql } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import {
  bookItems,
  schools,
  students,
} from "../../../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { documentNumber, epochTimeFragment, randomSerial } from "../../lib/document-number";
import { buildReceiptDraft } from "../payment-ledger";
import { validateOrderLines } from "./validation";
import { reserveLooseLines, resolveLooseLines } from "./intake";
import { normalizeNis } from "../student-lifecycle";
import { buildBookOrderWriteQueries } from "./book-order-write";

export interface DirectSaleItemInput {
  bookId: string;
  quantity: number;
}

export interface DirectSaleInput {
  schoolId: string;
  buyerName: string;
  buyerPhone: string;
  studentNis?: string;
  paymentMethod?: "cash" | "transfer";
  referenceNumber?: string;
  notes?: string;
  items: DirectSaleItemInput[];
}

export interface DirectSaleDeps {
  now?: () => string;
  generateId?: () => string;
  generateOrderNumber?: (nowIso: string) => string;
}

export type DirectSaleResult =
  | { ok: true; data: { id: string; orderNumber: string; totalAmount: number; buyerName: string } }
  | { ok: false; status: ContentfulStatusCode; message: string };

/**
 * Deep module: penjualan satuan langsung ke orang tua di Gudang Pusat.
 * Memakai ulang seam stok (`allocateLooseStock` FIFO + kondisi layak) dan
 * harga jual efektif kanonik; tulis order + item + pembayaran + mutasi
 * status fisik ke `sold` dalam satu Write Batch (chunk 10 baris).
 */
export async function sellDirect(
  database: AppDatabase,
  input: DirectSaleInput,
  deps: DirectSaleDeps = {}
): Promise<DirectSaleResult> {
  if (!input.schoolId) return { ok: false, status: 400, message: "Lokasi gudang wajib dipilih" };
  if (!input.buyerName) return { ok: false, status: 400, message: "Nama pembeli / orang tua wajib diisi" };
  const lineCheck = validateOrderLines(undefined, input.items);
  if (!lineCheck.ok) return lineCheck;

  const [loc] = await database.select().from(schools).where(eq(schools.id, input.schoolId));
  if (!loc || loc.type !== "warehouse") {
    return {
      ok: false,
      status: 403,
      message: "Penjualan satuan langsung ke ortu hanya dapat dilakukan di Gudang Pusat (HQ).",
    };
  }

  const resolved = await resolveLooseLines(database, input.items);
  if (!resolved.ok) return resolved;
  const titleByBookId = new Map(resolved.lines.map((l) => [l.bookId, l.title] as const));

  let totalAmount = 0;
  const saleLines: Array<{ bookId: string; quantity: number; unitPrice: number }> = [];
  const aggregated = new Map<string, { quantity: number; unitPrice: number }>();
  for (const line of resolved.lines) {
    const agg = aggregated.get(line.bookId) ?? { quantity: 0, unitPrice: line.unitPrice };
    agg.quantity += line.quantity;
    aggregated.set(line.bookId, agg);
  }
  for (const [bookId, agg] of aggregated) {
    totalAmount += agg.unitPrice * agg.quantity;
    saleLines.push({ bookId, quantity: agg.quantity, unitPrice: agg.unitPrice });
  }

  const reserved = await reserveLooseLines(database, input.schoolId, resolved.lines);
  if (!reserved.ok) {
    return {
      ok: false,
      status: 400,
      message: `Stok satuan tidak mencukupi untuk "${titleByBookId.get(reserved.bookId) ?? reserved.bookId}". Tersedia: ${reserved.available}, diminta: ${reserved.quantity}`,
    };
  }
  const allocatedIds = reserved.allocatedIds;

  // Penjualan langsung = uang diterima di kasir: order lunas & baris pembayaran
  // auto-verified (kasir sendiri yang mengonfirmasi, bukan klaim orang tua).
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const orderId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const orderNumber =
    deps.generateOrderNumber?.(now) ?? documentNumber("DIR", epochTimeFragment(Date.now(), 8), randomSerial(6));
  const genItemId = deps.generateId ?? (() => crypto.randomUUID());
  const paymentMethod = input.paymentMethod ?? "cash";

  // student_id NOT NULL + FK sejak migrasi awal: bila NIS murid terdaftar
  // diberikan, order menunjuk ke murid tersebut (NIS dinormalisasi kanonik);
  // bila tidak, walk-in tanpa murid terdaftar menunjuk ke placeholder per
  // gudang (idempoten — satu baris per gudang, bukan sampah per transaksi).
  // Tanpa ini endpoint selalu 500 (bug laten: route lama mengisi studentId null).
  const walkInStudentId = `walk-in-direct-${input.schoolId}`;
  let orderStudentId = walkInStudentId;
  if (input.studentNis?.trim()) {
    const [matched] = await database
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.schoolId, input.schoolId), eq(sql`lower(${students.nis})`, normalizeNis(input.studentNis))));
    if (matched) orderStudentId = matched.id;
  }

  const receiptId = genItemId();
  const receiptDraft = buildReceiptDraft(
    {
      studentId: orderStudentId,
      schoolId: input.schoolId,
      amount: totalAmount,
      allocations: [{ orderId, kind: "buku", amount: totalAmount, billAmount: totalAmount }],
      bankName: paymentMethod === "cash" ? "KAS TUNAI" : "TRANSFER DIRECT",
      referenceNumber: input.referenceNumber || documentNumber("RECEIPT", epochTimeFragment(Date.now(), 8)),
      autoVerify: true,
    },
    now,
    receiptId,
    { allocationId: () => `alc-${receiptId}` }
  );
  if (!receiptDraft.ok) return receiptDraft;

  const orderQueries = buildBookOrderWriteQueries({
    database,
    order: {
      id: orderId,
      orderNumber,
      schoolId: input.schoolId,
      studentId: orderStudentId,
      packageId: null,
      orderType: "regular",
      totalAmount,
      paidAmount: totalAmount,
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      handoverDate: now,
      handoverRecipient: input.buyerName,
      notes: `Direct Sale: ${input.buyerName} (${input.buyerPhone})${input.notes ? " - " + input.notes : ""}`,
      createdAt: now,
      updatedAt: now,
    },
    lines: saleLines,
    generateItemId: genItemId,
    receiptDraft: receiptDraft.draft,
    emitWprCharge: false,
  });

  try {
    await runWriteBatch(database, [
      database
        .insert(students)
        .values({
          id: walkInStudentId,
          schoolId: input.schoolId,
          nis: "WALK-IN-DIRECT",
          name: "Walk-in Direct Sale",
          gradeLevel: "0",
          academicYear: now.split("T")[0].split("-")[0],
          parentName: input.buyerName,
          parentPhone: input.buyerPhone,
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing(),
      ...orderQueries,
      // Guard status di WHERE: flip hanya menyentuh eksemplar yang masih
      // tersedia — balapan dua kasir tidak bisa menjual ulang baris yang sama.
      ...chunkRows(allocatedIds).map((chunk) =>
        database
          .update(bookItems)
          .set({ status: "sold", updatedAt: now })
          .where(and(inArray(bookItems.id, chunk), eq(bookItems.status, "in_stock")))
      ),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penjualan langsung");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  return { ok: true, data: { id: orderId, orderNumber, totalAmount, buyerName: input.buyerName } };
}
