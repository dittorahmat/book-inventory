import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  uniformVariants,
  uniformSizes,
  uniformStock,
  uniformPackages,
  uniformPackageBom,
  uniformPackageStock,
  uniformOrderItems,
  uniformOrders,
  uniformPos,
  uniformPoItems,
  uniformExchanges,
} from "../../../db/schema";
import {
  chunkRows,
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";
import { adjustVariantStockQuery } from "./stock";
import { KAIN_SIZE, UNIFORM_GENDERS, UNIFORM_JENJANG, UNIFORM_KINDS, type UniformError } from "./catalog";
import { validateUniformSizeRemoval } from "./mutation-guard";

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

export interface UpdateVariantInput {
  code?: string;
  name?: string;
  kind?: (typeof UNIFORM_KINDS)[number];
  gender?: (typeof UNIFORM_GENDERS)[number];
  jenjang?: (typeof UNIFORM_JENJANG)[number];
  academicYear?: string;
  price?: number;
  sizeChartUrl?: string | null;
  description?: string | null;
  sizes?: string[];
}

export interface UpdateUniformPackageInput {
  code?: string;
  name?: string;
  academicYear?: string;
  price?: number;
  description?: string | null;
  items?: Array<{ variantId: string; size?: string; quantity?: number }>;
}

export async function updateUniformVariant(
  database: AppDatabase,
  variantId: string,
  input: UpdateVariantInput,
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof uniformVariants.$inferSelect } | UniformError> {
  const [existing] = await database
    .select()
    .from(uniformVariants)
    .where(eq(uniformVariants.id, variantId))
    .limit(1);

  if (!existing) return { ok: false, status: 404, message: "Varian seragam tidak ditemukan." };

  if (input.code && input.code !== existing.code) {
    const [dup] = await database
      .select({ id: uniformVariants.id })
      .from(uniformVariants)
      .where(eq(uniformVariants.code, input.code))
      .limit(1);
    if (dup) return invalid("Kode varian sudah dipakai.");
  }

  const nextKind = input.kind ?? existing.kind;
  const nextGender = input.gender ?? existing.gender;
  const nextJenjang = input.jenjang ?? existing.jenjang;

  if (!UNIFORM_KINDS.includes(nextKind)) return invalid("Jenis seragam wajib kain_harian atau olahraga.");
  if (!UNIFORM_GENDERS.includes(nextGender)) return invalid("Gender varian wajib male atau female.");
  if (!UNIFORM_JENJANG.includes(nextJenjang)) return invalid("Jenjang wajib tk, sd, smp, atau sma.");

  const now = writeNow(deps);

  // Jika ukuran disediakan, verifikasi pengurangan ukuran terlindungi guard stok & order
  if (input.sizes !== undefined) {
    const newSizes = [...new Set(input.sizes.map((s) => s.trim()).filter(Boolean))];
    if (nextKind === "kain_harian" && newSizes.length > 0) {
      return invalid("Kain harian tanpa ukuran — kosongkan daftar size.");
    }
    if (nextKind === "olahraga" && newSizes.length === 0) {
      return invalid("Seragam olahraga wajib punya minimal satu size.");
    }

    const currentSizesRows = await database
      .select()
      .from(uniformSizes)
      .where(eq(uniformSizes.variantId, variantId));
    const currentSizes = currentSizesRows.map((s) => s.size);
    const removedSizes = currentSizes.filter((s) => !newSizes.includes(s));

    if (removedSizes.length > 0) {
      const guardRes = await validateUniformSizeRemoval(database, variantId, removedSizes);
      if (!guardRes.ok) return guardRes;

      // Aman hapus ukuran yang tidak ada di newSizes
      await database
        .delete(uniformSizes)
        .where(
          and(
            eq(uniformSizes.variantId, variantId),
            inArray(uniformSizes.size, removedSizes)
          )
        );
      // Hapus juga baris stok 0 yang terkait
      await database
        .delete(uniformStock)
        .where(
          and(
            eq(uniformStock.variantId, variantId),
            inArray(uniformStock.size, removedSizes)
          )
        );
    }

    // Tambah ukuran baru yang belum ada
    const addedSizes = newSizes.filter((s) => !currentSizes.includes(s));
    for (const rows of chunkRows(
      addedSizes.map((size, i) => ({
        id: newWriteId(deps),
        variantId,
        size,
        sortOrder: currentSizes.length + i,
        createdAt: now,
      }))
    )) {
      await runWriteBatch(database, [database.insert(uniformSizes).values(rows)]);
    }

    // Inisialisasi stok 0 untuk ukuran baru
    const stockQueries = addedSizes.map((size) =>
      adjustVariantStockQuery(database, { variantId, size, delta: 0 }, "create", deps)
    );
    for (const rows of chunkRows(stockQueries, 10)) {
      await runWriteBatch(database, rows);
    }
  }

  try {
    await database
      .update(uniformVariants)
      .set({
        code: input.code ?? existing.code,
        name: input.name ?? existing.name,
        kind: nextKind,
        gender: nextGender,
        jenjang: nextJenjang,
        academicYear: input.academicYear ?? existing.academicYear,
        price: input.price !== undefined ? input.price : existing.price,
        sizeChartUrl: input.sizeChartUrl !== undefined ? input.sizeChartUrl : existing.sizeChartUrl,
        description: input.description !== undefined ? input.description : existing.description,
        updatedAt: now,
      })
      .where(eq(uniformVariants.id, variantId));
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "memperbarui varian seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const [updated] = await database.select().from(uniformVariants).where(eq(uniformVariants.id, variantId)).limit(1);
  return { ok: true, data: updated };
}

export async function deleteUniformVariant(
  database: AppDatabase,
  variantId: string
): Promise<{ ok: true; data: { deleted: true } } | UniformError> {
  const [existing] = await database
    .select()
    .from(uniformVariants)
    .where(eq(uniformVariants.id, variantId))
    .limit(1);

  if (!existing) return { ok: false, status: 404, message: "Varian seragam tidak ditemukan." };

  // Guard 1: Cek stok > 0
  const stocks = await database
    .select()
    .from(uniformStock)
    .where(eq(uniformStock.variantId, variantId));
  const totalStock = stocks.reduce((acc, s) => acc + s.quantity, 0);
  if (totalStock > 0) {
    return invalid(`Varian ${existing.name} tidak dapat dihapus karena masih memiliki stok fisik (${totalStock} unit) di gudang.`);
  }

  // Guard 2: Cek order yang mereferensikan varian ini
  const orderRefs = await database
    .select({ orderNumber: uniformOrders.orderNumber })
    .from(uniformOrderItems)
    .innerJoin(uniformOrders, eq(uniformOrderItems.orderId, uniformOrders.id))
    .where(eq(uniformOrderItems.variantId, variantId))
    .limit(1);

  if (orderRefs.length > 0) {
    return invalid(`Varian ${existing.name} tidak dapat dihapus karena terikat pada riwayat pesanan seragam (${orderRefs[0].orderNumber}).`);
  }

  // Guard 3: Cek BOM paket seragam
  const bomRefs = await database
    .select({ packageName: uniformPackages.name })
    .from(uniformPackageBom)
    .innerJoin(uniformPackages, eq(uniformPackageBom.packageId, uniformPackages.id))
    .where(eq(uniformPackageBom.variantId, variantId))
    .limit(1);

  if (bomRefs.length > 0) {
    return invalid(`Varian ${existing.name} tidak dapat dihapus karena digunakan sebagai komponen BOM dalam ${bomRefs[0].packageName}.`);
  }

  // Guard 4: Cek PO seragam
  const poRefs = await database
    .select({ poNumber: uniformPos.poNumber })
    .from(uniformPoItems)
    .innerJoin(uniformPos, eq(uniformPoItems.poId, uniformPos.id))
    .where(eq(uniformPoItems.variantId, variantId))
    .limit(1);

  if (poRefs.length > 0) {
    return invalid(`Varian ${existing.name} tidak dapat dihapus karena terikat pada PO seragam (${poRefs[0].poNumber}).`);
  }

  // Guard 5: Cek penukaran seragam
  const exchangeRefs = await database
    .select({ id: uniformExchanges.id })
    .from(uniformExchanges)
    .where(
      sql`${uniformExchanges.oldVariantId} = ${variantId} OR ${uniformExchanges.newVariantId} = ${variantId}`
    )
    .limit(1);

  if (exchangeRefs.length > 0) {
    return invalid(`Varian ${existing.name} tidak dapat dihapus karena terikat pada riwayat penukaran seragam.`);
  }

  // Bersihkan uniformStock & uniformSizes & uniformVariants secara atomik via runWriteBatch
  await runWriteBatch(database, [
    database.delete(uniformStock).where(eq(uniformStock.variantId, variantId)),
    database.delete(uniformSizes).where(eq(uniformSizes.variantId, variantId)),
    database.delete(uniformVariants).where(eq(uniformVariants.id, variantId)),
  ]);

  return { ok: true, data: { deleted: true } };
}

export async function updateUniformPackage(
  database: AppDatabase,
  packageId: string,
  input: UpdateUniformPackageInput,
  deps?: WriteDeps
): Promise<{ ok: true; data: typeof uniformPackages.$inferSelect } | UniformError> {
  const [existing] = await database
    .select()
    .from(uniformPackages)
    .where(eq(uniformPackages.id, packageId))
    .limit(1);

  if (!existing) return { ok: false, status: 404, message: "Paket seragam tidak ditemukan." };

  if (input.code && input.code !== existing.code) {
    const [dup] = await database
      .select({ id: uniformPackages.id })
      .from(uniformPackages)
      .where(eq(uniformPackages.code, input.code))
      .limit(1);
    if (dup) return invalid("Kode paket sudah dipakai.");
  }

  const now = writeNow(deps);

  if (input.items !== undefined) {
    if (input.items.length === 0) return invalid("Paket wajib punya minimal satu komponen.");
    const variantIds = [...new Set(input.items.map((i) => i.variantId))];
    const found = await database
      .select({ id: uniformVariants.id })
      .from(uniformVariants)
      .where(inArray(uniformVariants.id, variantIds));
    if (found.length !== variantIds.length) return invalid("Ada varian komponen yang tidak dikenal.");

    // Ganti isi BOM
    await database.delete(uniformPackageBom).where(eq(uniformPackageBom.packageId, packageId));

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
  }

  try {
    await database
      .update(uniformPackages)
      .set({
        code: input.code ?? existing.code,
        name: input.name ?? existing.name,
        academicYear: input.academicYear ?? existing.academicYear,
        price: input.price !== undefined ? input.price : existing.price,
        description: input.description !== undefined ? input.description : existing.description,
        updatedAt: now,
      })
      .where(eq(uniformPackages.id, packageId));
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "memperbarui paket seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const [updated] = await database.select().from(uniformPackages).where(eq(uniformPackages.id, packageId)).limit(1);
  return { ok: true, data: updated };
}

export async function deleteUniformPackage(
  database: AppDatabase,
  packageId: string
): Promise<{ ok: true; data: { deleted: true } } | UniformError> {
  const [existing] = await database
    .select()
    .from(uniformPackages)
    .where(eq(uniformPackages.id, packageId))
    .limit(1);

  if (!existing) return { ok: false, status: 404, message: "Paket seragam tidak ditemukan." };

  // Guard 1: Cek stok paket siap kirim > 0
  const [stock] = await database
    .select()
    .from(uniformPackageStock)
    .where(eq(uniformPackageStock.packageId, packageId))
    .limit(1);

  if (stock && stock.quantity > 0) {
    return invalid(`Paket ${existing.name} tidak dapat dihapus karena masih memiliki ${stock.quantity} bundel rakitan siap kirim.`);
  }

  // Guard 2: Cek order yang memesan paket ini
  const orderRefs = await database
    .select({ orderNumber: uniformOrders.orderNumber })
    .from(uniformOrderItems)
    .innerJoin(uniformOrders, eq(uniformOrderItems.orderId, uniformOrders.id))
    .where(eq(uniformOrderItems.packageId, packageId))
    .limit(1);

  if (orderRefs.length > 0) {
    return invalid(`Paket ${existing.name} tidak dapat dihapus karena terikat pada riwayat pesanan seragam (${orderRefs[0].orderNumber}).`);
  }

  // Hapus BOM, paket stock, dan paket secara atomik via runWriteBatch
  await runWriteBatch(database, [
    database.delete(uniformPackageBom).where(eq(uniformPackageBom.packageId, packageId)),
    database.delete(uniformPackageStock).where(eq(uniformPackageStock.packageId, packageId)),
    database.delete(uniformPackages).where(eq(uniformPackages.id, packageId)),
  ]);

  return { ok: true, data: { deleted: true } };
}
