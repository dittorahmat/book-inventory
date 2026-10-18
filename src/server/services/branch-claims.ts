import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { branchCharges, branchClaims, schools, uniformOrderItems } from "../../db/schema";
import {
  chunkRows,
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  selectInChunks,
  writeNow,
  type WriteDeps,
} from "../lib/d1-write";
import { documentNumber, randomSerial } from "../lib/document-number";
import { PERIOD_RE, periodBounds } from "../lib/period";
import { readSettingsMap } from "./settings-map";

/**
 * Klaim Cabang: rekonsiliasi gudang → cabang per periode + sekolah, mencakup
 * buku DAN seragam lewat `branch_charges`. Angka dibekukan saat lock — tagihan
 * yang final setelahnya tidak menyentuh klaim terkunci, melainkan masuk klaim
 * periode berikutnya.
 */

/** Kunci `system_settings` ini sudah tersimpan di data produksi; nilainya jangan diubah. */
export const CLAIM_PREFIX_KEY = "uniform_claim_prefix";
export const DEFAULT_CLAIM_PREFIX = "CLM";

type ClaimRow = typeof branchClaims.$inferSelect;
type ChargeRow = typeof branchCharges.$inferSelect;

type ClaimError = { ok: false; status: 400 | 404; message: string };

const invalid = (message: string): ClaimError => ({ ok: false, status: 400, message });

export async function createBranchClaim(
  database: AppDatabase,
  input: { schoolId: string; period: string },
  deps?: WriteDeps & { claimPrefix?: string }
): Promise<{ ok: true; data: ClaimRow } | ClaimError> {
  const now = writeNow(deps);
  if (!PERIOD_RE.test(input.period)) return invalid("Periode wajib format YYYY-MM.");
  const [school] = await database.select({ id: schools.id }).from(schools).where(eq(schools.id, input.schoolId));
  if (!school) return invalid("Sekolah tidak dikenal.");

  const { end } = periodBounds(input.period);
  // Klaim = jumlah tagihan `final` yang belum masuk klaim dan jatuh di periode ini.
  // Tanpa batas bawah: tagihan yang final setelah klaim periode lalu dikunci
  // otomatis tersapu ke klaim berikutnya, bukan hilang.
  const charges: ChargeRow[] = await database
    .select()
    .from(branchCharges)
    .where(
      and(
        eq(branchCharges.schoolId, input.schoolId),
        eq(branchCharges.status, "final"),
        isNull(branchCharges.claimId),
        lt(branchCharges.finalizedAt, end)
      )
    );
  const goodsAmount = charges.reduce((sum, charge) => sum + charge.goodsAmount, 0);
  const shippingAmount = charges.reduce((sum, charge) => sum + charge.shippingAmount, 0);
  const totalAmount = goodsAmount + shippingAmount;
  const uniformOrderIds = charges.filter((c) => c.sourceType === "uniform_order").map((c) => c.sourceId);
  const items = uniformOrderIds.length > 0
    ? await selectInChunks(uniformOrderIds, (chunk) =>
        database
          .select({ quantity: uniformOrderItems.quantity })
          .from(uniformOrderItems)
          .where(inArray(uniformOrderItems.orderId, chunk))
      )
    : [];
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const prefix = deps?.claimPrefix ?? (await readSettingsMap(database))[CLAIM_PREFIX_KEY] ?? DEFAULT_CLAIM_PREFIX;

  const id = newWriteId(deps);
  try {
    await runWriteBatch(database, [
      database.insert(branchClaims).values({
        id,
        claimNumber: documentNumber(prefix, input.period.replace("-", ""), randomSerial(6)),
        schoolId: input.schoolId,
        period: input.period,
        status: "draft",
        totalQty,
        goodsAmount,
        shippingAmount,
        totalAmount,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(charges.map((c) => c.id), 90).map((ids) =>
        database.update(branchCharges).set({ claimId: id, updatedAt: now }).where(inArray(branchCharges.id, ids))
      ),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "membuat klaim cabang");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const [created]: ClaimRow[] = await database.select().from(branchClaims).where(eq(branchClaims.id, id));
  return { ok: true, data: created };
}

export async function lockBranchClaim(
  database: AppDatabase,
  claimId: string,
  deps?: WriteDeps
): Promise<{ ok: true; data: ClaimRow } | ClaimError> {
  const now = writeNow(deps);
  const [claim]: ClaimRow[] = await database.select().from(branchClaims).where(eq(branchClaims.id, claimId));
  if (!claim) return { ok: false, status: 404, message: "Klaim tidak ditemukan." };
  if (claim.status === "locked") return invalid("Klaim sudah dikunci.");
  await database
    .update(branchClaims)
    .set({ status: "locked", lockedAt: now, updatedAt: now })
    .where(eq(branchClaims.id, claimId));
  const [updated]: ClaimRow[] = await database.select().from(branchClaims).where(eq(branchClaims.id, claimId));
  return { ok: true, data: updated };
}

/**
 * Selisih antara angka yang tersimpan di klaim dan jumlah tagihan di bawahnya.
 * Nol = klaim masih cocok dengan tagihannya. Bukan nol = ada yang berubah
 * setelah klaim dibuat (mis. ongkir dikoreksi) dan wajib terlihat, bukan diam.
 */
const driftAmountOf = (claim: ClaimRow, chargedTotal: number): number => chargedTotal - claim.totalAmount;

const chargedTotalsByClaim = async (
  database: AppDatabase,
  claimIds: string[]
): Promise<Map<string, number>> => {
  if (claimIds.length === 0) return new Map();
  const rows = await selectInChunks(claimIds, (chunk) =>
    database
      .select({
        claimId: branchCharges.claimId,
        total: sql<number>`coalesce(sum(${branchCharges.goodsAmount} + ${branchCharges.shippingAmount}), 0)`,
      })
      .from(branchCharges)
      .where(inArray(branchCharges.claimId, chunk))
      .groupBy(branchCharges.claimId)
  );
  return new Map(rows.map((row) => [row.claimId ?? "", Number(row.total)]));
};

/** Klaim + tagihan yang mendasarinya (audit: angka harus bisa dijelaskan barisnya). */
export async function getBranchClaim(
  database: AppDatabase,
  claimId: string
): Promise<{ ok: true; data: { claim: ClaimRow; charges: ChargeRow[]; driftAmount: number } } | ClaimError> {
  const [claim]: ClaimRow[] = await database.select().from(branchClaims).where(eq(branchClaims.id, claimId));
  if (!claim) return { ok: false, status: 404, message: "Klaim tidak ditemukan." };
  const charges = await database
    .select()
    .from(branchCharges)
    .where(eq(branchCharges.claimId, claimId))
    .limit(500);
  const chargedTotal = charges.reduce((sum, c) => sum + c.goodsAmount + c.shippingAmount, 0);
  return { ok: true, data: { claim, charges, driftAmount: driftAmountOf(claim, chargedTotal) } };
}

export type ClaimListRow = ClaimRow & { driftAmount: number };

export async function listBranchClaims(database: AppDatabase, schoolId?: string): Promise<ClaimListRow[]> {
  const rows: ClaimRow[] = schoolId
    ? await database.select().from(branchClaims).where(eq(branchClaims.schoolId, schoolId)).orderBy(desc(branchClaims.period)).limit(50)
    : await database.select().from(branchClaims).orderBy(desc(branchClaims.period)).limit(50);
  const charged = await chargedTotalsByClaim(database, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, driftAmount: driftAmountOf(row, charged.get(row.id) ?? 0) }));
}
