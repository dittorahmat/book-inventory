import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { internalShipmentItems, internalShipments } from "../../../db/schema";
import { d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";

export type InternalReceiptCondition = "good" | "damaged" | "missing";

export interface InternalReceiptLineInput {
  shipmentItemId: string;
  condition: InternalReceiptCondition;
  notes?: string;
}

export interface ReceiveInternalShipmentInput {
  receivedDate?: string;
  receivedByUserId?: string;
  transferShipmentId?: string;
  deliveryProofUrl?: string;
  items: InternalReceiptLineInput[];
}

export type ReceiveInternalShipmentResult =
  | { ok: true; data: { shipmentId: string; status: "delivered" | "discrepancy" } }
  | { ok: false; status: 400 | 404; message: string };

type InternalShipmentRow = typeof internalShipments.$inferSelect;
type InternalShipmentItemRow = typeof internalShipmentItems.$inferSelect;

/**
 * Penerimaan Surat Jalan Internal oleh cabang: validasi keanggotaan baris
 * pra-tulis (400, bukan 500), lalu tulis kondisi per baris + status
 * (`delivered` bila semua baik, `discrepancy` bila ada non-baik) dalam satu
 * batch atomik via seam `lib/d1-write`. Mutasi stok fisik bukan di sini —
 * itu milik Transfer Shipment tertaut (ADR 0003).
 */
export async function receiveInternalShipment(
  database: AppDatabase,
  shipmentId: string,
  input: ReceiveInternalShipmentInput,
  now = new Date().toISOString()
): Promise<ReceiveInternalShipmentResult> {
  const [shipment]: InternalShipmentRow[] = await database
    .select()
    .from(internalShipments)
    .where(eq(internalShipments.id, shipmentId));
  if (!shipment) return { ok: false, status: 404, message: "Surat Jalan Internal tidak ditemukan" };
  if (shipment.status !== "in_transit") {
    return { ok: false, status: 400, message: "Hanya Surat Jalan berstatus dalam perjalanan yang dapat diterima" };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, status: 400, message: "Minimal 1 baris kondisi penerimaan wajib diisi" };
  }

  const lines: InternalShipmentItemRow[] = await database
    .select()
    .from(internalShipmentItems)
    .where(eq(internalShipmentItems.shipmentId, shipmentId));
  const known = new Set(lines.map((l) => l.id));
  const foreign = input.items.find((it) => !known.has(it.shipmentItemId));
  if (foreign) {
    return { ok: false, status: 400, message: `Baris ${foreign.shipmentItemId} bukan bagian dari Surat Jalan ini` };
  }

  const hasDiscrepancy = input.items.some((it) => it.condition !== "good");
  const nextStatus = hasDiscrepancy ? "discrepancy" : "delivered";

  try {
    await runWriteBatch(database, [
      ...input.items.map((it) =>
        database
          .update(internalShipmentItems)
          .set({ receivedCondition: it.condition, receivedNotes: it.notes || null })
          .where(eq(internalShipmentItems.id, it.shipmentItemId))
      ),
      database
        .update(internalShipments)
        .set({
          status: nextStatus,
          receivedDate: input.receivedDate || now.split("T")[0],
          receivedByUserId: input.receivedByUserId || shipment.receivedByUserId,
          transferShipmentId: input.transferShipmentId || shipment.transferShipmentId,
          deliveryProofUrl: input.deliveryProofUrl || shipment.deliveryProofUrl,
          updatedAt: now,
        })
        .where(eq(internalShipments.id, shipmentId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penerimaan Surat Jalan Internal");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  return { ok: true, data: { shipmentId, status: nextStatus } };
}
