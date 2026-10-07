import { eq } from "drizzle-orm";
import { db } from "../../db";
import { purchaseOrders, schools } from "../../db/schema";

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
      status: 404;
      message: string;
    };

/**
 * Deep module: proses penerimaan barang fisik inbound dari PO.
 * Mengenkapsulasi update kuantitas item PO, pembuatan nomor barcode batch,
 * penambahan eksemplar fisik ke book_items, dan penentuan status akhir PO.
 */
export async function receivePurchaseOrder(
  poId: string,
  receivedItems: ReceivedItemInput[]
): Promise<ReceivePoResult> {
  const { purchaseOrderItems, bookItems } = await import("../../db/schema");
  const now = new Date().toISOString();

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) {
    return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };
  }

  let totalReceivedThisBatch = 0;
  const newBookItemsToInsert: Array<typeof bookItems.$inferInsert> = [];

  for (const rec of receivedItems) {
    const [poItem] = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, rec.poItemId));

    if (!poItem) continue;

    const newReceived = poItem.quantityReceived + rec.quantityToReceive;
    await db
      .update(purchaseOrderItems)
      .set({ quantityReceived: newReceived })
      .where(eq(purchaseOrderItems.id, rec.poItemId));

    for (let k = 0; k < rec.quantityToReceive; k++) {
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

  if (newBookItemsToInsert.length > 0) {
    await db.insert(bookItems).values(newBookItemsToInsert);
  }

  const allPoItems = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));

  const isAllReceived = allPoItems.every((item: any) => item.quantityReceived >= item.quantityOrdered);
  const newStatus: "received" | "partially_received" = isAllReceived ? "received" : "partially_received";

  await db
    .update(purchaseOrders)
    .set({ status: newStatus, updatedAt: now })
    .where(eq(purchaseOrders.id, poId));

  return {
    ok: true,
    data: {
      poId,
      status: newStatus,
      totalReceivedThisBatch,
    },
  };
}
