import { like } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { internalShipments } from "../../../db/schema";
import { documentNumber, randomSerial } from "../../lib/document-number";
import { todayWIB } from "../../../lib/wib-time";

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
    : todayWIB();
  const prefix = `SJ-${date}-`;

  if (!database) {
    return documentNumber("SJ", date, randomSerial(6));
  }

  try {
    const existing = await database
      .select({ deliveryNoteNumber: internalShipments.deliveryNoteNumber })
      .from(internalShipments)
      .where(like(internalShipments.deliveryNoteNumber, `${prefix}%`));

    let maxSeq = 0;
    for (const row of existing) {
      if (!row.deliveryNoteNumber) continue;
      const match = row.deliveryNoteNumber.match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(3, "0")}`;
  } catch {
    return documentNumber("SJ", date, randomSerial(6));
  }
}
