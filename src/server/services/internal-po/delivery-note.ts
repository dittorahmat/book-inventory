import { desc, like } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { internalShipments } from "../../../db/schema";
import { documentNumber, randomSerial } from "../../lib/document-number";

/**
 * Membangkitkan nomor Surat Jalan internal pengiriman ke cabang dengan format:
 * SJ-YYYY-MM-DD-001 (urutan harian 3 digit) atau fallback serial acak jika tanpa DB.
 */
export async function generateDeliveryNoteNumber(
  database?: AppDatabase,
  dateStr?: string
): Promise<string> {
  const date = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr
    : new Date().toISOString().slice(0, 10);
  const prefix = `SJ-${date}-`;

  if (!database) {
    return documentNumber("SJ", date, randomSerial(3));
  }

  try {
    const [latest] = await database
      .select({ deliveryNoteNumber: internalShipments.deliveryNoteNumber })
      .from(internalShipments)
      .where(like(internalShipments.deliveryNoteNumber, `${prefix}%`))
      .orderBy(desc(internalShipments.deliveryNoteNumber))
      .limit(1);

    if (latest?.deliveryNoteNumber) {
      const match = latest.deliveryNoteNumber.match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const nextSeq = parseInt(match[1], 10) + 1;
        return `${prefix}${String(nextSeq).padStart(3, "0")}`;
      }
    }
  } catch {
    return documentNumber("SJ", date, randomSerial(3));
  }

  return `${prefix}001`;
}
