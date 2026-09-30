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
  if (LEGACY_PO_STATUSES.has(po.status)) return { allowed: true };
  if (po.signedDocUrl) return { allowed: true };
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

export function validateSignedDoc(file: File): SignedDocValidation {
  if (file.size === 0) {
    return { ok: false, message: "Berkas bukti kosong. Pilih berkas hasil scan atau foto dokumen bertanda tangan." };
  }
  if (file.size > SIGNED_DOC_MAX_BYTES) {
    return { ok: false, message: "Ukuran berkas bukti maksimal 10 MB." };
  }
  if (!(SIGNED_DOC_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: "Format berkas bukti harus gambar (JPG, PNG, WebP) atau PDF." };
  }
  return { ok: true, contentType: file.type };
}
