import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  suppliers,
  uniformVariants,
  uniformSizes,
  uniformStock,
  uniformPackages,
  uniformPackageBom,
  uniformPackageStock,
  uniformPos,
  uniformPoItems,
} from "../../../db/schema";
import {
  chunkRows,
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";
import { KAIN_SIZE, type UniformError } from "./catalog";

export interface UniformSupplyDeps extends WriteDeps {
  generatePoNumber?: (nowIso: string) => string;
}

export interface UniformPoLineInput {
  variantId: string;
  size?: string;
  quantityOrdered: number;
  unitPrice?: number;
}

export interface CreateUniformPoInput {
  supplierId: string;
  orderDate?: string;
  notes?: string;
  poNumber?: string;
  lines: UniformPoLineInput[];
}

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

const defaultPoNumber = (nowIso: string): string => `UPO-${nowIso.slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-4)}`;

async function assertLinesAllowed(
  database: AppDatabase,
  lines: Array<{ variantId: string; size?: string }>
): Promise<UniformError | null> {
  const variantIds = [...new Set(lines.map((l: { variantId: string }) => l.variantId))];
  const variants: Array<typeof uniformVariants.$inferSelect> = await database
    .select()
    .from(uniformVariants)
    .where(inArray(uniformVariants.id, variantIds));
  if (variants.length !== variantIds.length) return invalid("Ada varian yang tidak dikenal.");
  const kindById = new Map<string, string>(variants.map((v) => [v.id, v.kind]));
  const olahragaIds = variants.filter((v) => v.kind === "olahraga").map((v) => v.id);
  const allowed: Array<typeof uniformSizes.$inferSelect> =
    olahragaIds.length > 0
      ? await database.select().from(uniformSizes).where(inArray(uniformSizes.variantId, olahragaIds))
      : [];
  const allowedByVariant = new Map<string, Set<string>>();
  for (const s of allowed) {
    if (!allowedByVariant.has(s.variantId)) allowedByVariant.set(s.variantId, new Set());
    allowedByVariant.get(s.variantId)?.add(s.size);
  }
  for (const line of lines) {
    const kind = kindById.get(line.variantId);
    const size = line.size?.trim() || KAIN_SIZE;
    if (kind === "kain_harian" && size !== KAIN_SIZE) return invalid("Kain harian tanpa ukuran.");
    if (kind === "olahraga" && !allowedByVariant.get(line.variantId)?.has(size)) {
      return invalid(`Size ${size} tidak terdaftar untuk varian olahraga tersebut.`);
    }
  }
  return null;
}

export async function createUniformPo(
  database: AppDatabase,
  input: CreateUniformPoInput,
  deps?: UniformSupplyDeps
): Promise<{ ok: true; data: typeof uniformPos.$inferSelect } | UniformError> {
  const now = writeNow(deps);
  if (input.lines.length === 0) return invalid("PO wajib punya minimal satu baris.");
  if (input.lines.some((l) => l.quantityOrdered < 1)) return invalid("Kuantitas tiap baris minimal 1.");
  const [supplier] = await database.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, input.supplierId));
  if (!supplier) return invalid("Supplier tidak dikenal.");
  const blocked = await assertLinesAllowed(database, input.lines);
  if (blocked) return blocked;

  const poId = newWriteId(deps);
  const poNumber = input.poNumber?.trim() || (deps?.generatePoNumber ?? defaultPoNumber)(now);
  const total = input.lines.reduce((sum, l) => sum + l.quantityOrdered * (l.unitPrice ?? 0), 0);
  try {
    await database.insert(uniformPos).values({
      id: poId,
      poNumber,
      supplierId: input.supplierId,
      status: "draft",
      orderDate: input.orderDate ?? now.slice(0, 10),
      totalAmount: total,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "membuat PO seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  for (const rows of chunkRows(
    input.lines.map((l) => ({
      id: newWriteId(deps),
      poId,
      variantId: l.variantId,
      size: l.size?.trim() || KAIN_SIZE,
      quantityOrdered: l.quantityOrdered,
      quantityReceived: 0,
      unitPrice: l.unitPrice ?? 0,
      createdAt: now,
    }))
  )) {
    await runWriteBatch(database, [database.insert(uniformPoItems).values(rows)]);
  }
  const [created] = await database.select().from(uniformPos).where(eq(uniformPos.id, poId));
  return { ok: true, data: created };
}

export interface ReceiveLineInput {
  variantId: string;
  size?: string;
  quantity: number;
}

export async function receiveUniformPo(
  database: AppDatabase,
  poId: string,
  lines: ReceiveLineInput[],
  deps?: UniformSupplyDeps
): Promise<{ ok: true; data: typeof uniformPos.$inferSelect } | UniformError> {
  const now = writeNow(deps);
  const [po] = await database.select().from(uniformPos).where(eq(uniformPos.id, poId));
  if (!po) return { ok: false, status: 404, message: "PO seragam tidak ditemukan." };
  if (po.status === "cancelled" || po.status === "received") return invalid("PO sudah selesai atau dibatalkan.");
  if (lines.length === 0 || lines.some((l) => l.quantity < 1)) return invalid("Baris penerimaan tidak valid.");

  const poLines: Array<typeof uniformPoItems.$inferSelect> = await database
    .select()
    .from(uniformPoItems)
    .where(eq(uniformPoItems.poId, poId));
  const remainingByKey = new Map<string, number>(
    poLines.map((l) => [`${l.variantId}::${l.size}`, l.quantityOrdered - l.quantityReceived])
  );
  // Tulis sekuensial (§10): update terima + upsert stok per baris, tanpa Promise.all.
  for (const line of lines) {
    const size = line.size?.trim() || KAIN_SIZE;
    const remaining = remainingByKey.get(`${line.variantId}::${size}`) ?? -1;
    if (remaining < line.quantity) return invalid(`Penerimaan melebihi sisa PO untuk varian/size tersebut.`);
    const target = poLines.find((l) => l.variantId === line.variantId && l.size === size);
    if (!target) return invalid("Baris penerimaan tidak ada di PO.");
    await database
      .update(uniformPoItems)
      .set({ quantityReceived: target.quantityReceived + line.quantity })
      .where(eq(uniformPoItems.id, target.id));
    const [stock] = await database
      .select()
      .from(uniformStock)
      .where(and(eq(uniformStock.variantId, line.variantId), eq(uniformStock.size, size)));
    if (stock) {
      await database.update(uniformStock).set({ quantity: stock.quantity + line.quantity, updatedAt: now }).where(eq(uniformStock.id, stock.id));
    } else {
      await database.insert(uniformStock).values({ id: newWriteId(deps), variantId: line.variantId, size, quantity: line.quantity, updatedAt: now });
    }
    remainingByKey.set(`${line.variantId}::${size}`, remaining - line.quantity);
  }
  const done = [...remainingByKey.values()].every((r) => r === 0);
  await database
    .update(uniformPos)
    .set({ status: done ? "received" : "partially_received", updatedAt: now })
    .where(eq(uniformPos.id, poId));
  const [updated] = await database.select().from(uniformPos).where(eq(uniformPos.id, poId));
  return { ok: true, data: updated };
}

export async function assembleUniformPackages(
  database: AppDatabase,
  packageId: string,
  quantity: number,
  sizeOverrides?: Record<string, string>,
  deps?: UniformSupplyDeps
): Promise<{ ok: true; data: { packageId: string; quantityAssembled: number } } | UniformError> {
  const now = writeNow(deps);
  if (quantity < 1) return invalid("Kuantitas rakit minimal 1.");
  const [pkg] = await database.select().from(uniformPackages).where(eq(uniformPackages.id, packageId));
  if (!pkg) return { ok: false, status: 404, message: "Paket seragam tidak ditemukan." };
  const bom = await database
    .select({
      variantId: uniformPackageBom.variantId,
      size: uniformPackageBom.size,
      quantity: uniformPackageBom.quantity,
      kind: uniformVariants.kind,
    })
    .from(uniformPackageBom)
    .innerJoin(uniformVariants, eq(uniformPackageBom.variantId, uniformVariants.id))
    .where(eq(uniformPackageBom.packageId, packageId));
  if (bom.length === 0) return invalid("Paket belum punya BOM.");

  const need = new Map<string, { size: string; qty: number }>();
  for (const line of bom) {
    const size = line.size !== KAIN_SIZE ? line.size : line.kind === "kain_harian" ? KAIN_SIZE : (sizeOverrides?.[line.variantId]?.trim() || "");
    if (!size) return invalid("Size olahraga wajib dipilih saat merakit (BOM memakai —).");
    const key = `${line.variantId}::${size}`;
    need.set(key, { size, qty: (need.get(key)?.qty ?? 0) + line.quantity * quantity });
  }
  const stocks: Array<typeof uniformStock.$inferSelect> = await database.select().from(uniformStock);
  const qtyByKey = new Map<string, typeof uniformStock.$inferSelect>(
    stocks.map((s) => [`${s.variantId}::${s.size}`, s])
  );
  for (const [key, n] of need) {
    if ((qtyByKey.get(key)?.quantity ?? 0) < n.qty) return invalid("Stok komponen tidak cukup untuk merakit.");
  }
  // Tulis sekuensial (§10): kurangi komponen lalu tambah stok paket.
  for (const [key, n] of need) {
    const row = qtyByKey.get(key);
    if (!row) continue;
    await database.update(uniformStock).set({ quantity: row.quantity - n.qty, updatedAt: now }).where(eq(uniformStock.id, row.id));
  }
  const [ready] = await database.select().from(uniformPackageStock).where(eq(uniformPackageStock.packageId, packageId));
  if (ready) {
    await database.update(uniformPackageStock).set({ quantity: ready.quantity + quantity, updatedAt: now }).where(eq(uniformPackageStock.id, ready.id));
  } else {
    await database.insert(uniformPackageStock).values({ id: newWriteId(deps), packageId, quantity, updatedAt: now });
  }
  return { ok: true, data: { packageId, quantityAssembled: quantity } };
}
