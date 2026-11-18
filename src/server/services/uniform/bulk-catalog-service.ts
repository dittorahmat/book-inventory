import type { AppDatabase } from "../../../db";
import {
  uniformVariants,
  uniformSizes,
  uniformPackages,
  uniformPackageBom,
} from "../../../db/schema";
import {
  parseUniformCatalogRows,
  buildDefaultUniformPackages,
  type UniformCatalogRowInput,
  type ParsedUniformVariant,
  type DefaultUniformPackageDefinition,
} from "../../../lib/uniform-catalog-parser";
import { eq, inArray } from "drizzle-orm";

export interface BulkUniformCatalogPayload {
  rows: UniformCatalogRowInput[];
  academicYear: string;
  sizeChartUrl?: string | null;
  autoBundlePackages?: boolean;
}

export interface BulkCatalogPreviewResult {
  variants: Array<ParsedUniformVariant & { isNew: boolean }>;
  packages: DefaultUniformPackageDefinition[];
  summary: {
    totalVariants: number;
    newVariantsCount: number;
    updateVariantsCount: number;
    totalPackages: number;
    skippedCount: number;
  };
}

export interface BulkCatalogCommitResult {
  insertedVariants: number;
  updatedVariants: number;
  packagesCreatedOrUpdated: number;
}

const CHUNK_SIZE = 10;

export async function previewBulkUniformCatalog(
  database: AppDatabase,
  payload: BulkUniformCatalogPayload
): Promise<BulkCatalogPreviewResult> {
  const { variants, skippedCount } = parseUniformCatalogRows(payload.rows, {
    academicYear: payload.academicYear,
    sizeChartUrl: payload.sizeChartUrl,
  });

  const packages = payload.autoBundlePackages !== false
    ? buildDefaultUniformPackages(variants, payload.academicYear)
    : [];

  const codes = variants.map((v) => v.code);
  const existingVariants = codes.length > 0
    ? await database.query.uniformVariants.findMany({
        where: inArray(uniformVariants.code, codes),
      })
    : [];

  const existingCodeSet = new Set(existingVariants.map((e) => e.code));

  let newCount = 0;
  let updateCount = 0;

  const previewVariants = variants.map((v) => {
    const isNew = !existingCodeSet.has(v.code);
    if (isNew) newCount++;
    else updateCount++;
    return { ...v, isNew };
  });

  return {
    variants: previewVariants,
    packages,
    summary: {
      totalVariants: variants.length,
      newVariantsCount: newCount,
      updateVariantsCount: updateCount,
      totalPackages: packages.length,
      skippedCount,
    },
  };
}

export async function commitBulkUniformCatalog(
  database: AppDatabase,
  payload: BulkUniformCatalogPayload
): Promise<BulkCatalogCommitResult> {
  const preview = await previewBulkUniformCatalog(database, payload);
  const now = new Date().toISOString();

  let insertedCount = 0;
  let updatedCount = 0;

  // 1. Process variants & sizes
  for (const variant of preview.variants) {
    if (variant.isNew) {
      await database.insert(uniformVariants).values({
        id: variant.id,
        code: variant.code,
        name: variant.name,
        kind: variant.kind,
        gender: variant.gender,
        jenjang: variant.jenjang,
        academicYear: variant.academicYear,
        price: variant.price,
        sizeChartUrl: variant.sizeChartUrl,
        description: variant.description,
        createdAt: now,
        updatedAt: now,
      });

      // Insert sizes for this variant
      for (let i = 0; i < variant.sizes.length; i += CHUNK_SIZE) {
        const sizeChunk = variant.sizes.slice(i, i + CHUNK_SIZE);
        await database.insert(uniformSizes).values(
          sizeChunk.map((sz, idx) => ({
            id: `usz-${variant.id}-${sz.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
            variantId: variant.id,
            size: sz,
            sortOrder: i + idx,
            createdAt: now,
          }))
        );
      }
      insertedCount++;
    } else {
      await database
        .update(uniformVariants)
        .set({
          name: variant.name,
          price: variant.price,
          description: variant.description,
          updatedAt: now,
        })
        .where(eq(uniformVariants.code, variant.code));
      updatedCount++;
    }
  }

  // 2. Process packages & BOM
  let packagesCount = 0;
  for (const pkg of preview.packages) {
    const existing = await database.query.uniformPackages.findFirst({
      where: eq(uniformPackages.code, pkg.code),
    });

    const packageId = existing ? existing.id : pkg.id;

    if (existing) {
      await database
        .update(uniformPackages)
        .set({
          name: pkg.name,
          price: pkg.price,
          description: pkg.description,
          updatedAt: now,
        })
        .where(eq(uniformPackages.id, packageId));

      // Hapus BOM lama lalu insert ulang
      await database.delete(uniformPackageBom).where(eq(uniformPackageBom.packageId, packageId));
    } else {
      await database.insert(uniformPackages).values({
        id: packageId,
        code: pkg.code,
        name: pkg.name,
        academicYear: pkg.academicYear,
        price: pkg.price,
        description: pkg.description,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Insert BOM items
    for (let i = 0; i < pkg.items.length; i += CHUNK_SIZE) {
      const chunk = pkg.items.slice(i, i + CHUNK_SIZE);
      await database.insert(uniformPackageBom).values(
        chunk.map((it) => ({
          id: `bom-${packageId}-${it.variantId}`,
          packageId,
          variantId: it.variantId,
          size: "STANDAR",
          quantity: it.quantity,
          createdAt: now,
        }))
      );
    }
    packagesCount++;
  }

  return {
    insertedVariants: insertedCount,
    updatedVariants: updatedCount,
    packagesCreatedOrUpdated: packagesCount,
  };
}
