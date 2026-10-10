import { eq, inArray } from "drizzle-orm";
import { db, type AppDatabase } from "../../db";
import { books, bookItems, purchaseOrders, purchaseOrderItems, suppliers, schools } from "../../db/schema";
import { calcPoHeader, effectiveBuyPrice } from "../../lib/book-pricing";
import { chunkRows, D1_WRITE_CHUNK_SIZE, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";

/**
 * Status PO yang berasal dari sebelum alur cetak–TTD–upload. PO pada status ini
 * tidak boleh diwajibkan memiliki bukti TTD (spec: "PO lama tidak terdampak").
 */
export const LEGACY_PO_STATUSES: ReadonlySet<string> = new Set([
  "ordered",
  "sent",
  "partially_received",
  "received",
  "cancelled",
]);

/** Status alur baru: wajib melewati cetak → tanda tangan → upload sebelum kirim. */
export const PRINTED_STATUS = "printed";
export const SIGNED_UPLOADED_STATUS = "signed_uploaded";

export type PoRow = typeof purchaseOrders.$inferSelect;

/** ID lokasi gudang logistik (tunggal). Semua PO diarahkan ke gudang. */
export async function resolveWarehouseId(): Promise<string | null> {
  const [warehouse] = await db
    .select({ id: schools.id })
    .from(schools)
    .where(eq(schools.type, "warehouse"))
    .limit(1);
  return warehouse?.id ?? null;
}

export type WarehouseTargetResult =
  | { ok: true; warehouseId: string }
  | { ok: false; message: string };

/**
 * Kunci tujuan PO ke lokasi gudang (design D1).
 * Bila request menyebut tujuan lain, request ditolak; bila tidak menyebut, diisi server-side.
 */
export async function resolveWarehouseTarget(
  requestedTargetId: string | undefined
): Promise<WarehouseTargetResult> {
  const warehouseId = await resolveWarehouseId();
  if (!warehouseId) {
    return { ok: false, message: "Lokasi Gudang Logistik belum tersedia. Tambahkan gudang di master lokasi terlebih dahulu." };
  }
  if (requestedTargetId && requestedTargetId !== warehouseId) {
    return {
      ok: false,
      message: "Purchase Order hanya dapat ditujukan ke Gudang Logistik. Tujuan purchase adalah penerimaan barang di gudang.",
    };
  }
  return { ok: true, warehouseId };
}

export type SendGate = { allowed: true } | { allowed: false; message: string };

/**
 * Gerbang kirim di server (design D6): aksi kirim ditolak bila PO pada alur baru
 * belum memiliki berkas bukti TTD + cap. PO lama berstatus di luar alur baru tetap valid.
 */
export function evaluateSendGate(po: Pick<PoRow, "status" | "signedDocUrl" | "poNumber">): SendGate {
  if (LEGACY_PO_STATUSES.has(po.status) || po.signedDocUrl) return { allowed: true };
  return {
    allowed: false,
    message:
      `PO ${po.poNumber} belum memiliki bukti tanda tangan basah dan cap. Upload berkas bukti terlebih dahulu sebelum mengirim ke supplier.`,
  };
}

/** Berkas bukti yang boleh diupload: gambar atau PDF, maksimal 10 MB. */
export const SIGNED_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const SIGNED_DOC_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type SignedDocValidation =
  | { ok: true; contentType: string }
  | { ok: false; message: string };

export const validateSignedDoc = (file: File): SignedDocValidation =>
  file.size === 0
    ? { ok: false, message: "Berkas bukti kosong. Pilih berkas hasil scan atau foto dokumen bertanda tangan." }
    : file.size > SIGNED_DOC_MAX_BYTES
      ? { ok: false, message: "Ukuran berkas bukti maksimal 10 MB." }
      : !(SIGNED_DOC_ALLOWED_TYPES as readonly string[]).includes(file.type)
        ? { ok: false, message: "Format berkas bukti harus gambar (JPG, PNG, WebP) atau PDF." }
        : { ok: true, contentType: file.type };

export interface ReceivedItemInput {
  poItemId: string;
  quantityToReceive: number;
}

export interface CreatePoItemInput {
  bookId: string;
  quantityOrdered: number;
  unitPrice?: number;
  discountPercent?: number;
}

export interface CreatePoInput {
  supplierId: string;
  targetSchoolId?: string;
  orderDate: string;
  expectedArrivalDate?: string;
  notes?: string;
  items: CreatePoItemInput[];
}

/** Injeksi deterministik untuk test: jam, ID header, nomor PO, dan ID baris item. */
export interface CreatePoDeps {
  now?: () => string;
  generateId?: () => string;
  generatePoNumber?: (nowIso: string) => string;
  generateItemId?: () => string;
}

export interface CreatedPoItem {
  id: string;
  bookId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  discountPercent: number;
}

export interface CreatedPo {
  id: string;
  poNumber: string;
  supplierId: string;
  targetSchoolId: string;
  status: "draft";
  orderDate: string;
  expectedArrivalDate: string | null;
  subtotalGross: number;
  discountTotal: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: CreatedPoItem[];
}

export type CreatePoResult =
  | { ok: true; data: CreatedPo }
  | { ok: false; status: 400 | 404; message: string };

/** Validasi pra-tulis baris PO bersama create + receive (400, bukan 500). */
const validateCreatePoLines = (items: CreatePoItemInput[]): string | null => {
  if (!Array.isArray(items) || items.length === 0) return "Minimal 1 buku dalam PO";
  const bad = items.find(
    (it) =>
      !it.bookId ||
      !Number.isInteger(it.quantityOrdered) ||
      it.quantityOrdered < 1 ||
      (it.unitPrice !== undefined && !(it.unitPrice >= 0)) ||
      (it.discountPercent !== undefined && !(it.discountPercent >= 0 && it.discountPercent <= 100))
  );
  return !bad
    ? null
    : !bad.bookId
      ? "Buku wajib dipilih"
      : "Jumlah minimal 1, harga ≥ 0, diskon 0–100";
};

/**
 * Deep module: pembuatan Purchase Order bersanding dengan receivePurchaseOrder.
 * Berbagi validasi pra-tulis (gudang + baris), harga beli efektif
 * (`effectiveBuyPrice`), dan penomoran deterministik yang dapat diinjeksi.
 * Tulis induk + anak atomik via seam `lib/d1-write` (batch di D1, sekuensial
 * di bun-sqlite, insert item di-chunk maksimal 10 baris).
 */
export async function createPurchaseOrder(
  database: AppDatabase,
  input: CreatePoInput,
  deps: CreatePoDeps = {}
): Promise<CreatePoResult> {
  if (!input.supplierId) return { ok: false, status: 400, message: "Supplier wajib dipilih" };
  if (!input.orderDate) return { ok: false, status: 400, message: "Tanggal order wajib diisi" };
  const lineError = validateCreatePoLines(input.items);
  if (lineError) return { ok: false, status: 400, message: lineError };

  const [supplier] = await database.select().from(suppliers).where(eq(suppliers.id, input.supplierId));
  if (!supplier) return { ok: false, status: 400, message: "Supplier tidak ditemukan" };

  const target = await resolveWarehouseTarget(input.targetSchoolId);
  if (!target.ok) return { ok: false, status: 400, message: target.message };

  const bookIds = [...new Set(input.items.map((it) => it.bookId))];
  const priceRows: Array<{ id: string; price: number; buyPrice: number; sellPrice: number }> = await database
    .select({ id: books.id, price: books.price, buyPrice: books.buyPrice, sellPrice: books.sellPrice })
    .from(books)
    .where(inArray(books.id, bookIds));
  const priceById = new Map<string, number>(priceRows.map((r) => [r.id, effectiveBuyPrice(r)]));
  const missing = bookIds.filter((id) => !priceById.has(id));
  if (missing.length > 0) return { ok: false, status: 400, message: `Buku tidak ditemukan: ${missing[0]}` };

  const resolved: CreatedPoItem[] = input.items.map((it) => ({
    id: "",
    bookId: it.bookId,
    quantityOrdered: it.quantityOrdered,
    quantityReceived: 0,
    unitPrice: it.unitPrice ?? priceById.get(it.bookId) ?? 0,
    discountPercent: it.discountPercent ?? 0,
  }));

  const { subtotalGross, discountTotal, totalAmount } = calcPoHeader(resolved);
  const nowIso = (deps.now ?? (() => new Date().toISOString()))();
  const poId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const poNumber = (deps.generatePoNumber ?? (() => `PO-${Date.now().toString().slice(-8)}`))(nowIso);
  const genItemId = deps.generateItemId ?? (() => crypto.randomUUID());
  const items: CreatedPoItem[] = resolved.map((r) => ({ ...r, id: genItemId() }));

  try {
    await runWriteBatch(database, [
      database.insert(purchaseOrders).values({
        id: poId,
        poNumber,
        supplierId: input.supplierId,
        targetSchoolId: target.warehouseId,
        status: "draft",
        orderDate: input.orderDate,
        expectedArrivalDate: input.expectedArrivalDate || null,
        subtotalGross,
        discountTotal,
        totalAmount,
        notes: input.notes || null,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
      ...chunkRows(items.map((it) => ({
        id: it.id,
        purchaseOrderId: poId,
        bookId: it.bookId,
        quantityOrdered: it.quantityOrdered,
        quantityReceived: 0,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
        createdAt: nowIso,
      })), D1_WRITE_CHUNK_SIZE).map((rows) => database.insert(purchaseOrderItems).values(rows)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pembuatan purchase order");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    data: {
      id: poId,
      poNumber,
      supplierId: input.supplierId,
      targetSchoolId: target.warehouseId,
      status: "draft",
      orderDate: input.orderDate,
      expectedArrivalDate: input.expectedArrivalDate || null,
      subtotalGross,
      discountTotal,
      totalAmount,
      notes: input.notes || null,
      createdAt: nowIso,
      updatedAt: nowIso,
      items,
    },
  };
}

export type ReceivePoResult =
  | {
      ok: true;
      data: {
        poId: string;
        status: "received" | "partially_received";
        totalReceivedThisBatch: number;
      };
    }
  | {
      ok: false;
      status: 400;
      message: string;
    }
  | {
      ok: false;
      status: 404;
      message: string;
    };

/**
 * Deep module: proses penerimaan barang fisik inbound dari PO.
 * Validasi keanggotaan item + sisa kuantitas dilakukan sebelum tulis apa pun
 * (400, bukan 500); tulis induk + anak dieksekusi atomik via seam
 * `lib/d1-write` (batch di D1, sekuensial di bun-sqlite, insert di-chunk).
 */
export async function receivePurchaseOrder(
  database: AppDatabase,
  poId: string,
  receivedItems: ReceivedItemInput[]
): Promise<ReceivePoResult> {
  const now = new Date().toISOString();

  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) {
    return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };
  }

  // Satu query baca untuk semua item PO: validasi sebelum tulis apa pun.
  const poItems: any[] = await database
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));
  const poItemById = new Map<string, any>(poItems.map((it: any) => [it.id, it]));

  const increments = new Map<string, number>();
  for (const rec of receivedItems) {
    const poItem = poItemById.get(rec.poItemId);
    if (!poItem) {
      return { ok: false, status: 400, message: `Item PO tidak valid untuk ${po.poNumber}` };
    }
    const next = (increments.get(rec.poItemId) ?? 0) + rec.quantityToReceive;
    const remaining = poItem.quantityOrdered - poItem.quantityReceived;
    if (next > remaining) {
      return { ok: false, status: 400, message: `Jumlah terima melebihi sisa ${remaining} eks untuk PO ${po.poNumber}` };
    }
    increments.set(rec.poItemId, next);
  }

  let totalReceivedThisBatch = 0;
  const newBookItemsToInsert: Array<typeof bookItems.$inferInsert> = [];
  for (const [poItemId, qty] of increments) {
    const poItem = poItemById.get(poItemId)!;
    for (let k = 0; k < qty; k++) {
      const barcode = `INB-PO-${Date.now().toString().slice(-6)}-${k + 1}-${crypto.randomUUID().slice(0, 6)}`;
      newBookItemsToInsert.push({
        id: crypto.randomUUID(),
        bookId: poItem.bookId,
        currentSchoolId: po.targetSchoolId,
        barcode,
        condition: "new",
        status: "in_stock",
        notes: `Inbound receiving from ${po.poNumber}`,
        createdAt: now,
        updatedAt: now,
      });
      totalReceivedThisBatch++;
    }
  }
  if (totalReceivedThisBatch === 0) {
    return { ok: false, status: 400, message: "Tidak ada item yang diterima" };
  }

  const newStatus: "received" | "partially_received" = poItems.every(
    (item: any) => item.quantityReceived + (increments.get(item.id) ?? 0) >= item.quantityOrdered
  )
    ? "received"
    : "partially_received";

  try {
    const writes = [
      ...[...increments].map(([poItemId, qty]) =>
        database
          .update(purchaseOrderItems)
          .set({ quantityReceived: poItemById.get(poItemId)!.quantityReceived + qty })
          .where(eq(purchaseOrderItems.id, poItemId))
      ),
      ...chunkRows(newBookItemsToInsert, D1_WRITE_CHUNK_SIZE).map((rows) =>
        database.insert(bookItems).values(rows)
      ),
      database
        .update(purchaseOrders)
        .set({ status: newStatus, updatedAt: now })
        .where(eq(purchaseOrders.id, poId)),
    ];
    await runWriteBatch(database, writes);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "mencatat penerimaan");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    data: {
      poId,
      status: newStatus,
      totalReceivedThisBatch,
    },
  };
}
