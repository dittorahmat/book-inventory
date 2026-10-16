import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { bookItems, schools } from "../../../db/schema";
import type { studentBookOrders } from "../../../db/schema";
import { D1_INLIST_CHUNK_SIZE, chunkRows } from "../../lib/d1-write";

export interface SalesHandoverRow {
  schoolId: string;
  schoolName: string;
  orderCount: number;
  revenue: number;
  collected: number;
  shippingTotal: number;
}

export interface SalesHandoverSection {
  orderCount: number;
  revenue: number;
  collected: number;
  shippingTotal: number;
  bySchool: SalesHandoverRow[];
}

/** Agregat serah-terima cabang→ortu untuk tagihan ke finance. */
export function buildHandoverSection(
  orders: Array<typeof studentBookOrders.$inferSelect>,
  schoolName: Map<string, string>
): SalesHandoverSection {
  const handed = orders.filter((o) => o.fulfillmentStatus === "picked_up");
  const bySchool = new Map<string, SalesHandoverRow>();
  for (const o of handed) {
    const row = bySchool.get(o.schoolId) ?? {
      schoolId: o.schoolId, schoolName: schoolName.get(o.schoolId) ?? o.schoolId,
      orderCount: 0, revenue: 0, collected: 0, shippingTotal: 0,
    };
    row.orderCount += 1;
    row.revenue += o.totalAmount;
    row.collected += o.paidAmount;
    row.shippingTotal += o.shippingCost ?? 0;
    bySchool.set(o.schoolId, row);
  }
  return {
    orderCount: handed.length,
    revenue: handed.reduce((s, o) => s + o.totalAmount, 0),
    collected: handed.reduce((s, o) => s + o.paidAmount, 0),
    shippingTotal: handed.reduce((s, o) => s + (o.shippingCost ?? 0), 0),
    bySchool: [...bySchool.values()].sort((a, b) => b.revenue - a.revenue),
  };
}

/** Eksemplar reject di sekolah dalam cakupan (flag ok/reject gudang). */
export async function countRejectedItems(database: AppDatabase, schoolIds: string[]): Promise<number> {
  if (schoolIds.length === 0) return 0;
  const counts = await Promise.all(
    chunkRows(schoolIds, D1_INLIST_CHUNK_SIZE).map(async (chunk) => {
      const rows = await database
        .select({ id: bookItems.id })
        .from(bookItems)
        .where(and(inArray(bookItems.currentSchoolId, chunk), eq(bookItems.isRejected, true)));
      return rows.length;
    })
  );
  return counts.reduce((s, n) => s + n, 0);
}

export async function loadSchoolNames(database: AppDatabase): Promise<Map<string, string>> {
  const rows: Array<{ id: string; name: string }> = await database
    .select({ id: schools.id, name: schools.name })
    .from(schools);
  return new Map(rows.map((s) => [s.id, s.name]));
}
