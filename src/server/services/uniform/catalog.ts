import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  uniformVariants,
  uniformSizes,
  uniformStock,
  uniformPackages,
  uniformPackageBom,
  uniformPackageStock,
} from "../../../db/schema";
import {
  chunkRows,
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";

export type UniformError = { ok: false; status: 400 | 404; message: string };

export const UNIFORM_KINDS = ["kain_harian", "olahraga"] as const;
export const UNIFORM_GENDERS = ["male", "female"] as const;
export const UNIFORM_JENJANG = ["tk", "sd", "smp", "sma"] as const;
/** Ukuran semu untuk kain harian (tanpa ukuran) di stok, order, dan laporan. */
export const KAIN_SIZE = "—";

type VariantRow = typeof uniformVariants.$inferSelect;
type SizeRow = typeof uniformSizes.$inferSelect;
type StockRow = typeof uniformStock.$inferSelect;

export interface CreateVariantInput {
  code: string;
  name: string;
  kind: (typeof UNIFORM_KINDS)[number];
  gender: (typeof UNIFORM_GENDERS)[number];
  jenjang: (typeof UNIFORM_JENJANG)[number];
  academicYear: string;
  price?: number;
  sizeChartUrl?: string;
  description?: string;
  sizes?: string[];
}

export interface CreateUniformPackageInput {
  code: string;
  name: string;
  academicYear: string;
  price?: number;
  description?: string;
  items: Array<{ variantId: string; size?: string; quantity?: number }>;
}

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

export async function createUniformVariant(
  database: AppDatabase,
  input: CreateVariantInput,
  deps?: WriteDeps
): Promise<{ ok: true; data: { variant: VariantRow; sizes: string[] } } | UniformError> {
  const now = writeNow(deps);
  if (!UNIFORM_KINDS.includes(input.kind)) return invalid("Jenis seragam wajib kain_harian atau olahraga.");
  if (!UNIFORM_GENDERS.includes(input.gender)) return invalid("Gender varian wajib male atau female.");
  if (!UNIFORM_JENJANG.includes(input.jenjang)) return invalid("Jenjang wajib tk, sd, smp, atau sma.");
  const sizes = [...new Set((input.sizes ?? []).map((s) => s.trim()).filter(Boolean))];
  if (input.kind === "kain_harian" && sizes.length > 0) return invalid("Kain harian tanpa ukuran — kosongkan daftar size.");
  if (input.kind === "olahraga" && sizes.length === 0) return invalid("Seragam olahraga wajib punya minimal satu size.");

  const [dup] = await database
    .select({ id: uniformVariants.id })
    .from(uniformVariants)
    .where(eq(uniformVariants.code, input.code));
  if (dup) return invalid("Kode varian sudah dipakai.");

  const variantId = newWriteId(deps);
  try {
    await database.insert(uniformVariants).values({
      id: variantId,
      code: input.code,
      name: input.name,
      kind: input.kind,
      gender: input.gender,
      jenjang: input.jenjang,
      academicYear: input.academicYear,
      price: input.price ?? 0,
      sizeChartUrl: input.sizeChartUrl ?? null,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "membuat varian seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  for (const rows of chunkRows(
    sizes.map((size, i) => ({ id: newWriteId(deps), variantId, size, sortOrder: i, createdAt: now }))
  )) {
    await runWriteBatch(database, [database.insert(uniformSizes).values(rows)]);
  }
  for (const rows of chunkRows(
    (input.kind === "kain_harian" ? [KAIN_SIZE] : sizes).map((size) => ({
      id: newWriteId(deps),
      variantId,
      size,
      quantity: 0,
      updatedAt: now,
    }))
  )) {
    await runWriteBatch(database, [database.insert(uniformStock).values(rows)]);
  }

  const [created] = await database.select().from(uniformVariants).where(eq(uniformVariants.id, variantId));
  return { ok: true, data: { variant: created, sizes } };
}

export interface VariantWithStock {
  variant: VariantRow;
  sizes: string[];
  stock: Array<{ size: string; quantity: number }>;
}

export async function listUniformVariants(database: AppDatabase): Promise<VariantWithStock[]> {
  const variants: VariantRow[] = await database.select().from(uniformVariants);
  const sizes: SizeRow[] = await database.select().from(uniformSizes);
  const stocks: StockRow[] = await database.select().from(uniformStock);
  const sizesByVariant = new Map<string, string[]>();
  for (const s of sizes) sizesByVariant.set(s.variantId, [...(sizesByVariant.get(s.variantId) ?? []), s.size]);
  const stockByVariant = new Map<string, Array<{ size: string; quantity: number }>>();
  for (const s of stocks) {
    stockByVariant.set(s.variantId, [...(stockByVariant.get(s.variantId) ?? []), { size: s.size, quantity: s.quantity }]);
  }
  return variants.map((variant) => ({
    variant,
    sizes: sizesByVariant.get(variant.id) ?? [],
    stock: stockByVariant.get(variant.id) ?? [],
  }));
}

export async function createUniformPackage(
  database: AppDatabase,
  input: CreateUniformPackageInput,
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof uniformPackages.$inferSelect } | UniformError> {
  const now = writeNow(deps);
  if (input.items.length === 0) return invalid("Paket wajib punya minimal satu komponen.");
  const [dup] = await database
    .select({ id: uniformPackages.id })
    .from(uniformPackages)
    .where(eq(uniformPackages.code, input.code));
  if (dup) return invalid("Kode paket sudah dipakai.");

  const variantIds = [...new Set(input.items.map((i) => i.variantId))];
  const found = await database
    .select({ id: uniformVariants.id })
    .from(uniformVariants)
    .where(inArray(uniformVariants.id, variantIds));
  if (found.length !== variantIds.length) return invalid("Ada varian komponen yang tidak dikenal.");

  const packageId = newWriteId(deps);
  try {
    await database.insert(uniformPackages).values({
      id: packageId,
      code: input.code,
      name: input.name,
      academicYear: input.academicYear,
      price: input.price ?? 0,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "membuat paket seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  for (const rows of chunkRows(
    input.items.map((item) => ({
      id: newWriteId(deps),
      packageId,
      variantId: item.variantId,
      size: item.size?.trim() || KAIN_SIZE,
      quantity: item.quantity ?? 1,
      createdAt: now,
    }))
  )) {
    await runWriteBatch(database, [database.insert(uniformPackageBom).values(rows)]);
  }
  await database.insert(uniformPackageStock).values({ id: newWriteId(deps), packageId, quantity: 0, updatedAt: now });

  const [created] = await database.select().from(uniformPackages).where(eq(uniformPackages.id, packageId));
  return { ok: true, data: created };
}

export interface PackageWithBom {
  package: typeof uniformPackages.$inferSelect;
  bom: Array<{ variantId: string; variantName: string; kind: string; size: string; quantity: number }>;
  readyQty: number;
}

type PackageRow = typeof uniformPackages.$inferSelect;
type PackageStockRow = typeof uniformPackageStock.$inferSelect;

export async function listUniformPackages(database: AppDatabase): Promise<PackageWithBom[]> {
  const pkgs: PackageRow[] = await database.select().from(uniformPackages);
  if (pkgs.length === 0) return [];
  const bom: Array<PackageWithBom["bom"][number] & { packageId: string }> = await database
    .select({
      packageId: uniformPackageBom.packageId,
      variantId: uniformPackageBom.variantId,
      size: uniformPackageBom.size,
      quantity: uniformPackageBom.quantity,
      variantName: uniformVariants.name,
      kind: uniformVariants.kind,
    })
    .from(uniformPackageBom)
    .innerJoin(uniformVariants, eq(uniformPackageBom.variantId, uniformVariants.id));
  const ready: PackageStockRow[] = await database.select().from(uniformPackageStock);
  const readyByPkg = new Map<string, number>(ready.map((r: PackageStockRow) => [r.packageId, r.quantity]));
  const bomByPkg = new Map<string, PackageWithBom["bom"]>();
  for (const b of bom) bomByPkg.set(b.packageId, [...(bomByPkg.get(b.packageId) ?? []), b]);
  return pkgs.map((p: PackageRow) => ({ package: p, bom: bomByPkg.get(p.id) ?? [], readyQty: readyByPkg.get(p.id) ?? 0 }));
}
