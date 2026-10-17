import { desc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { schools, uniformClaims, uniformOrders, uniformOrderItems } from "../../../db/schema";
import {
  d1WriteErrorStatus,
  newWriteId,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";
import { documentNumber } from "../../lib/document-number";
import { readSettingsMap } from "../settings-map";
import type { UniformError } from "./catalog";

export const UNIFORM_CLAIM_PREFIX_KEY = "uniform_claim_prefix";
export const DEFAULT_UNIFORM_CLAIM_PREFIX = "CLM";

type ClaimRow = typeof uniformClaims.$inferSelect;

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const periodBounds = (period: string): { start: string; end: string } => {
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${period}-01`, end: `${next}-01` };
};

/**
 * Klaim Cabang: snapshot gudang→cabang per periode+sekolah. Angka dibekukan
 * saat lock — mutasi pasca-lock (tukar/refund susulan) tidak menyentuh klaim
 * terkunci; selisihnya diselesaikan manual pada periode berikut.
 */
export async function createUniformClaim(
  database: AppDatabase,
  input: { schoolId: string; period: string },
  deps?: WriteDeps & { claimPrefix?: string }
): Promise<{ ok: true; data: ClaimRow } | UniformError> {
  const now = writeNow(deps);
  if (!PERIOD_RE.test(input.period)) return invalid("Periode wajib format YYYY-MM.");
  const [school] = await database.select({ id: schools.id }).from(schools).where(eq(schools.id, input.schoolId));
  if (!school) return invalid("Sekolah tidak dikenal.");

  const { start, end } = periodBounds(input.period);
  const orders: Array<typeof uniformOrders.$inferSelect> = await database
    .select()
    .from(uniformOrders)
    .where(eq(uniformOrders.schoolId, input.schoolId));
  const inPeriod = orders.filter((o) => o.createdAt >= start && o.createdAt < end);
  let totalQty = 0;
  if (inPeriod.length > 0) {
    const items: Array<typeof uniformOrderItems.$inferSelect> = await database
      .select()
      .from(uniformOrderItems)
      .where(inArray(uniformOrderItems.orderId, inPeriod.map((o) => o.id)));
    totalQty = items.reduce((s, i) => s + i.quantity, 0);
  }
  const totalAmount = inPeriod.reduce((s, o) => s + o.totalAmount, 0);
  const prefix = deps?.claimPrefix ?? (await readSettingsMap(database))[UNIFORM_CLAIM_PREFIX_KEY] ?? DEFAULT_UNIFORM_CLAIM_PREFIX;

  const id = newWriteId(deps);
  try {
    await database.insert(uniformClaims).values({
      id,
      claimNumber: documentNumber(prefix, input.period.replace("-", ""), Math.floor(Math.random() * 900 + 100)),
      schoolId: input.schoolId,
      period: input.period,
      status: "draft",
      totalQty,
      totalAmount,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "membuat klaim seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const [created]: ClaimRow[] = await database.select().from(uniformClaims).where(eq(uniformClaims.id, id));
  return { ok: true, data: created };
}

export async function lockUniformClaim(
  database: AppDatabase,
  claimId: string,
  deps?: WriteDeps
): Promise<{ ok: true; data: ClaimRow } | UniformError> {
  const now = writeNow(deps);
  const [claim]: ClaimRow[] = await database.select().from(uniformClaims).where(eq(uniformClaims.id, claimId));
  if (!claim) return { ok: false, status: 404, message: "Klaim tidak ditemukan." };
  if (claim.status === "locked") return invalid("Klaim sudah dikunci.");
  await database
    .update(uniformClaims)
    .set({ status: "locked", lockedAt: now, updatedAt: now })
    .where(eq(uniformClaims.id, claimId));
  const [updated]: ClaimRow[] = await database.select().from(uniformClaims).where(eq(uniformClaims.id, claimId));
  return { ok: true, data: updated };
}

export async function listUniformClaims(database: AppDatabase, schoolId?: string): Promise<ClaimRow[]> {
  const rows: ClaimRow[] = schoolId
    ? await database.select().from(uniformClaims).where(eq(uniformClaims.schoolId, schoolId)).orderBy(desc(uniformClaims.period)).limit(50)
    : await database.select().from(uniformClaims).orderBy(desc(uniformClaims.period)).limit(50);
  return rows;
}
