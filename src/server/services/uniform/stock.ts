import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { uniformPackageStock, uniformSizes, uniformStock, uniformVariants } from "../../../db/schema";
import { newWriteId, writeNow, type WriteDeps } from "../../lib/d1-write";
import { KAIN_SIZE } from "./catalog";

export interface UniformStockLine {
  kind: "package" | "variant";
  id: string; // packageId or variantId
  size?: string;
  quantity: number;
}

export interface UniformAvailabilityResult {
  ok: boolean;
  shortfalls: Array<{
    kind: "package" | "variant";
    id: string;
    size: string;
    requested: number;
    available: number;
  }>;
}

/**
 * Validasi apakah size diizinkan untuk varian tertentu:
 * - kain_harian wajib KAIN_SIZE ("-")
 * - olahraga wajib size terdaftar di uniform_sizes
 */
export async function assertSizeAllowed(
  database: AppDatabase,
  variant: { id: string; kind: string },
  size: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = size?.trim() || KAIN_SIZE;
  if (variant.kind === "kain_harian" && normalized !== KAIN_SIZE) {
    return { ok: false, message: "Kain harian tanpa ukuran." };
  }
  if (variant.kind === "olahraga") {
    const [found] = await database
      .select({ size: uniformSizes.size })
      .from(uniformSizes)
      .where(and(eq(uniformSizes.variantId, variant.id), eq(uniformSizes.size, normalized)));
    if (!found) {
      return { ok: false, message: `Size ${normalized} tidak terdaftar untuk varian olahraga tersebut.` };
    }
  }
  return { ok: true };
}

/**
 * Validasi batch size untuk banyak varian sekaligus.
 */
export async function assertSizesAllowed(
  database: AppDatabase,
  items: Array<{ variantId: string; size?: string }>
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (items.length === 0) return { ok: true };
  const variantIds = Array.from(new Set(items.map((i) => i.variantId)));
  const variants = await database
    .select({ id: uniformVariants.id, kind: uniformVariants.kind })
    .from(uniformVariants)
    .where(inArray(uniformVariants.id, variantIds));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const olahragaIds = variants.filter((v) => v.kind === "olahraga").map((v) => v.id);
  const allowedSizes = olahragaIds.length > 0
    ? await database.select().from(uniformSizes).where(inArray(uniformSizes.variantId, olahragaIds))
    : [];
  const allowedSet = new Set(allowedSizes.map((s) => `${s.variantId}::${s.size}`));

  for (const item of items) {
    const v = variantById.get(item.variantId);
    if (!v) continue;
    const size = item.size?.trim() || KAIN_SIZE;
    if (v.kind === "kain_harian" && size !== KAIN_SIZE) {
      return { ok: false, message: "Kain harian tanpa ukuran." };
    }
    if (v.kind === "olahraga" && !allowedSet.has(`${v.id}::${size}`)) {
      return { ok: false, message: `Size ${size} tidak terdaftar untuk varian olahraga tersebut.` };
    }
  }
  return { ok: true };
}

/**
 * Menghitung ketersediaan stok untuk daftar baris (paket atau varian)
 * tanpa me-load semua baris tak terkait (anti-full scan).
 */
export async function checkUniformAvailability(
  database: AppDatabase,
  lines: UniformStockLine[]
): Promise<UniformAvailabilityResult> {
  const pkgLines = lines.filter((l) => l.kind === "package");
  const varLines = lines.filter((l) => l.kind === "variant");

  const shortfalls: UniformAvailabilityResult["shortfalls"] = [];

  if (pkgLines.length > 0) {
    const pkgIds = Array.from(new Set(pkgLines.map((l) => l.id)));
    const ready = await database
      .select()
      .from(uniformPackageStock)
      .where(inArray(uniformPackageStock.packageId, pkgIds));
    const readyMap = new Map(ready.map((r) => [r.packageId, r.quantity]));

    const neededByPkg = new Map<string, number>();
    for (const l of pkgLines) {
      neededByPkg.set(l.id, (neededByPkg.get(l.id) ?? 0) + l.quantity);
    }
    for (const [pkgId, needed] of neededByPkg) {
      const avail = readyMap.get(pkgId) ?? 0;
      if (avail < needed) {
        shortfalls.push({ kind: "package", id: pkgId, size: "-", requested: needed, available: avail });
      }
    }
  }

  if (varLines.length > 0) {
    const neededByVar = new Map<string, { variantId: string; size: string; quantity: number }>();
    for (const l of varLines) {
      const size = l.size?.trim() || KAIN_SIZE;
      const key = `${l.id}::${size}`;
      const cur = neededByVar.get(key) ?? { variantId: l.id, size, quantity: 0 };
      cur.quantity += l.quantity;
      neededByVar.set(key, cur);
    }

    const varIds = Array.from(new Set(varLines.map((l) => l.id)));
    const stocks = await database
      .select()
      .from(uniformStock)
      .where(inArray(uniformStock.variantId, varIds));
    const stockMap = new Map(stocks.map((s) => [`${s.variantId}::${s.size}`, s.quantity]));

    for (const [key, cur] of neededByVar) {
      const avail = stockMap.get(key) ?? 0;
      if (avail < cur.quantity) {
        shortfalls.push({ kind: "variant", id: cur.variantId, size: cur.size, requested: cur.quantity, available: avail });
      }
    }
  }

  return { ok: shortfalls.length === 0, shortfalls };
}

/**
 * Satu-satunya mutator stok seragam. Perbedaan "baris wajib ada", "buat bila
 * hilang", dan "lewati bila hilang" adalah kebijakan yang dinamai di call site,
 * bukan lima salinan update/insert dengan perilaku berbeda diam-diam.
 */
export type StockPolicy = "require" | "create" | "skip";

export interface VariantStockChange {
  variantId: string;
  size: string;
  delta: number;
}

export interface PackageStockChange {
  packageId: string;
  delta: number;
}

/** Query builder hidup: perubahan stok varian-size (delta, bukan nilai absolut). */
export const adjustVariantStockQuery = (
  database: AppDatabase,
  change: VariantStockChange,
  policy: StockPolicy,
  deps?: WriteDeps
) => {
  const now = writeNow(deps);
  const nextQuantity = sql`${uniformStock.quantity} + ${change.delta}`;
  if (policy === "create") {
    return database
      .insert(uniformStock)
      .values({
        id: newWriteId(deps),
        variantId: change.variantId,
        size: change.size,
        quantity: change.delta,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [uniformStock.variantId, uniformStock.size],
        set: { quantity: nextQuantity, updatedAt: now },
      });
  }
  return database
    .update(uniformStock)
    .set({ quantity: nextQuantity, updatedAt: now })
    .where(and(eq(uniformStock.variantId, change.variantId), eq(uniformStock.size, change.size)));
};

/** Query builder hidup: perubahan stok paket rakitan (delta). */
export const adjustPackageStockQuery = (
  database: AppDatabase,
  change: PackageStockChange,
  policy: StockPolicy,
  deps?: WriteDeps
) => {
  const now = writeNow(deps);
  const nextQuantity = sql`${uniformPackageStock.quantity} + ${change.delta}`;
  if (policy === "create") {
    return database
      .insert(uniformPackageStock)
      .values({
        id: newWriteId(deps),
        packageId: change.packageId,
        quantity: change.delta,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: uniformPackageStock.packageId,
        set: { quantity: nextQuantity, updatedAt: now },
      });
  }
  return database
    .update(uniformPackageStock)
    .set({ quantity: nextQuantity, updatedAt: now })
    .where(eq(uniformPackageStock.packageId, change.packageId));
};

/** Seed/opname: baris sentinel kain lama ("—") dibuang agar tidak dobel. */
export const deleteLegacyKainStockQuery = (database: AppDatabase, variantId: string) =>
  database.delete(uniformStock).where(and(eq(uniformStock.variantId, variantId), eq(uniformStock.size, "—")));

/** Stok manual mode "set": upsert nilai absolut (bukan delta). */
export const setVariantStockQuery = (
  database: AppDatabase,
  input: { variantId: string; size: string; quantity: number },
  deps?: WriteDeps
) => {
  const now = writeNow(deps);
  return database
    .insert(uniformStock)
    .values({
      id: newWriteId(deps),
      variantId: input.variantId,
      size: input.size,
      quantity: input.quantity,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [uniformStock.variantId, uniformStock.size],
      set: { quantity: input.quantity, updatedAt: now },
    });
};

/** Stok paket mode "set": upsert nilai absolut (bukan delta). */
export const setPackageStockQuery = (
  database: AppDatabase,
  input: { packageId: string; quantity: number },
  deps?: WriteDeps
) => {
  const now = writeNow(deps);
  return database
    .insert(uniformPackageStock)
    .values({
      id: newWriteId(deps),
      packageId: input.packageId,
      quantity: input.quantity,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: uniformPackageStock.packageId,
      set: { quantity: input.quantity, updatedAt: now },
    });
};
