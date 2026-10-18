import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { branchCharges, schools, uniformClaims, uniformOrderItems } from "../../../db/schema";
import {
  chunkRows,
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  selectInChunks,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";
import { documentNumber, randomSerial } from "../../lib/document-number";
import { PERIOD_RE, periodBounds } from "../../lib/period";
import { readSettingsMap } from "../settings-map";
import type { UniformError } from "./catalog";

export const UNIFORM_CLAIM_PREFIX_KEY = "uniform_claim_prefix";
export const DEFAULT_UNIFORM_CLAIM_PREFIX = "CLM";

type ClaimRow = typeof uniformClaims.$inferSelect;
type ChargeRow = typeof branchCharges.$inferSelect;

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });



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

  const { end } = periodBounds(input.period);
  // Klaim = jumlah tagihan `final` yang belum masuk klaim dan jatuh di periode ini.
  // Tagihan `open` (ongkir belum diinput) sengaja dilewati, bukan ditebak.
  const charges: ChargeRow[] = await database
    .select()
    .from(branchCharges)
    .where(
      and(
        eq(branchCharges.schoolId, input.schoolId),
        eq(branchCharges.status, "final"),
        isNull(branchCharges.claimId),
        // Semua tagihan final yang belum diklaim sampai akhir periode ini.
        // Tanpa batas bawah: tagihan yang final setelah klaim periode lalu
        // dikunci otomatis tersapu ke klaim berikutnya, bukan hilang.
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
  const prefix = deps?.claimPrefix ?? (await readSettingsMap(database))[UNIFORM_CLAIM_PREFIX_KEY] ?? DEFAULT_UNIFORM_CLAIM_PREFIX;

  const id = newWriteId(deps);
  try {
    await runWriteBatch(database, [
      database.insert(uniformClaims).values({
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

/** Klaim + tagihan yang mendasarinya (audit: angka harus bisa dijelaskan barisnya). */
export async function getUniformClaim(
  database: AppDatabase,
  claimId: string
): Promise<{ ok: true; data: { claim: ClaimRow; charges: ChargeRow[] } } | UniformError> {
  const [claim]: ClaimRow[] = await database.select().from(uniformClaims).where(eq(uniformClaims.id, claimId));
  if (!claim) return { ok: false, status: 404, message: "Klaim tidak ditemukan." };
  const charges = await database
    .select()
    .from(branchCharges)
    .where(eq(branchCharges.claimId, claimId))
    .limit(500);
  return { ok: true, data: { claim, charges } };
}

export async function listUniformClaims(database: AppDatabase, schoolId?: string): Promise<ClaimRow[]> {
  const rows: ClaimRow[] = schoolId
    ? await database.select().from(uniformClaims).where(eq(uniformClaims.schoolId, schoolId)).orderBy(desc(uniformClaims.period)).limit(50)
    : await database.select().from(uniformClaims).orderBy(desc(uniformClaims.period)).limit(50);
  return rows;
}
