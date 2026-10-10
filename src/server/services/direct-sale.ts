import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  bookItems,
  books,
  orderPayments,
  schools,
  studentBookOrders,
  studentOrderItems,
  students,
} from "../../db/schema";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { allocateLooseStock } from "./stock-allocation";

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
  | { ok: false; status: 400 | 403 | 404; message: string };

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
  if (!input.items || input.items.length === 0) return { ok: false, status: 400, message: "Minimal 1 buku dipilih" };

  const [loc] = await database.select().from(schools).where(eq(schools.id, input.schoolId));
  if (!loc || loc.type !== "warehouse") {
    return {
      ok: false,
      status: 403,
      message: "Penjualan satuan langsung ke ortu hanya dapat dilakukan di Gudang Pusat (HQ).",
    };
  }

  const bookIds = [...new Set(input.items.map((it) => it.bookId))];
  const bookRows =
    bookIds.length > 0
      ? await database
          .select({ id: books.id, title: books.title, price: books.price, buyPrice: books.buyPrice, sellPrice: books.sellPrice })
          .from(books)
          .where(inArray(books.id, bookIds))
      : [];
  const bookMap = new Map<string, { id: string; title: string; price: number; buyPrice: number; sellPrice: number }>(
    bookRows.map((b: { id: string; title: string; price: number; buyPrice: number; sellPrice: number }) => [b.id, b])
  );
  const missing = bookIds.find((id) => !bookMap.has(id));
  if (missing) return { ok: false, status: 404, message: `Buku dengan ID ${missing} tidak ditemukan` };

  let totalAmount = 0;
  const saleLines: Array<{ bookId: string; quantity: number; unitPrice: number }> = [];
  const allocatedIds: string[] = [];
  const aggregated = new Map<string, number>();
  for (const item of input.items) aggregated.set(item.bookId, (aggregated.get(item.bookId) ?? 0) + item.quantity);
  for (const [bookId, quantity] of aggregated) {
    const book = bookMap.get(bookId)!;
    const unitPrice = effectiveSellPrice(book);
    totalAmount += unitPrice * quantity;
    saleLines.push({ bookId, quantity, unitPrice });

    const allocated = await allocateLooseStock({ bookId, schoolId: input.schoolId, quantity }, database);
    if (!allocated.ok) {
      return {
        ok: false,
        status: 400,
        message: `Stok satuan tidak mencukupi untuk "${book.title}". Tersedia: ${allocated.available ?? 0}, diminta: ${quantity}`,
      };
    }
    allocatedIds.push(...allocated.items.map((i) => i.id));
  }

  const now = (deps.now ?? (() => new Date().toISOString()))();
  const orderId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const orderNumber =
    deps.generateOrderNumber?.(now) ?? `DIR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
  const genItemId = deps.generateId ?? (() => crypto.randomUUID());
  const paymentMethod = input.paymentMethod ?? "cash";

  const orderItemRows = saleLines.map((line) => ({
    id: genItemId(),
    orderId,
    bookId: line.bookId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    createdAt: now,
  }));

  // student_id NOT NULL + FK sejak migrasi awal: direct sale walk-in tanpa
  // murid terdaftar menunjuk ke placeholder per gudang (idempoten — satu
  // baris per gudang, bukan sampah per transaksi). Tanpa ini endpoint selalu
  // 500 (bug laten: route lama mengisi studentId null).
  const walkInStudentId = `walk-in-direct-${input.schoolId}`;

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
      database.insert(studentBookOrders).values({
        id: orderId,
        orderNumber,
        schoolId: input.schoolId,
        studentId: walkInStudentId,
        packageId: null,
        totalAmount,
        paidAmount: totalAmount,
        paymentStatus: "paid",
        fulfillmentStatus: "picked_up",
        handoverDate: now,
        handoverRecipient: input.buyerName,
        notes: `Direct Sale: ${input.buyerName} (${input.buyerPhone})${input.notes ? " - " + input.notes : ""}`,
        orderType: "regular",
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(orderItemRows).map((chunk) => database.insert(studentOrderItems).values(chunk)),
      ...chunkRows(allocatedIds).map((chunk) =>
        database.update(bookItems).set({ status: "sold", updatedAt: now }).where(inArray(bookItems.id, chunk))
      ),
      database.insert(orderPayments).values({
        id: genItemId(),
        orderId,
        transferAmount: totalAmount,
        bookAllocationAmount: totalAmount,
        bankName: paymentMethod === "cash" ? "KAS TUNAI" : "TRANSFER DIRECT",
        referenceNumber: input.referenceNumber || `RECEIPT-${Date.now().toString().slice(-6)}`,
        paymentDate: now,
        verificationStatus: "verified",
        createdAt: now,
      }),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penjualan langsung");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  return { ok: true, data: { id: orderId, orderNumber, totalAmount, buyerName: input.buyerName } };
}
