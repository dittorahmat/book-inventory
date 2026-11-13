import type { UniformPackageRow, UniformVariantRow } from "../components/uniform/uniform-admin-api";

/** Simbol ukuran standar untuk kain harian yang tidak memiliki varian ukuran fisik. */
export const UNIFORM_KAIN_SIZE = "—";

/**
 * Mendapatkan saldo stok fisik yang tersedia untuk sebuah varian seragam berdasarkan ukuran target.
 * Mengenkapsulasi detail pencarian ukuran pada entitas UniformVariantRow.
 */
export function getVariantStockQuantity(variantRow: UniformVariantRow, targetSize: string): number {
  const normalizedTarget = targetSize.trim();
  if (normalizedTarget === UNIFORM_KAIN_SIZE) {
    const stockEntry = variantRow.stock.find((s) => s.size === UNIFORM_KAIN_SIZE);
    return stockEntry ? stockEntry.quantity : variantRow.stock.reduce((acc, s) => acc + s.quantity, 0);
  }

  const stockEntry = variantRow.stock.find(
    (s) => s.size.trim().toLowerCase() === normalizedTarget.toLowerCase()
  );
  return stockEntry?.quantity ?? 0;
}

export interface UniformAssemblyPotentialBreakdown {
  /** Jumlah paket maksimal yang dapat dirakit saat ini */
  maxPossible: number;
  /** Komponen pembatas (botol leher) perakitan */
  bottleneckName: string | null;
  /** Keterangan status atau alasan jika perakitan tidak memungkinkan */
  reason: string | null;
}

/**
 * Menghitung potensi rakit maksimal paket seragam berdasarkan ketersediaan bahan/komponen di gudang.
 * 
 * Aturan Domain:
 * 1. Komponen kain_harian selalu menjadi pembatas utama (botol leher).
 * 2. Komponen olahraga jika ada di BOM:
 *    - Jika targetSize belum diisi, perhitungan tetap berfokus pada kesiapan bahan kain harian.
 *    - Jika targetSize diisi (mis. "M", "L"), stok ukuran spesifik tersebut diperhitungkan sebagai batasan rakit
 *      guna mencegah kegagalan validasi backend saat eksekusi perakitan.
 */
export function calculateUniformAssemblyPotentialDetails(
  pkg: UniformPackageRow,
  variants: UniformVariantRow[],
  targetSize?: string
): UniformAssemblyPotentialBreakdown {
  if (!pkg.bom || pkg.bom.length === 0) {
    return {
      maxPossible: 0,
      bottleneckName: null,
      reason: "BOM paket belum memiliki komponen terdaftar.",
    };
  }

  let maxPossible = Infinity;
  let bottleneckName: string | null = null;

  for (const item of pkg.bom) {
    if (item.quantity <= 0) continue;

    const variantRow = variants.find((v) => v.variant.id === item.variantId);
    if (!variantRow) {
      return {
        maxPossible: 0,
        bottleneckName: item.variantName,
        reason: `Komponen "${item.variantName}" tidak ditemukan di katalog gudang.`,
      };
    }

    let availableStock = 0;
    const kind = item.kind;

    if (kind === "kain_harian") {
      availableStock = getVariantStockQuantity(variantRow, UNIFORM_KAIN_SIZE);
    } else if (kind === "olahraga") {
      if (item.size && item.size !== UNIFORM_KAIN_SIZE) {
        availableStock = getVariantStockQuantity(variantRow, item.size);
      } else if (targetSize && targetSize.trim()) {
        availableStock = getVariantStockQuantity(variantRow, targetSize.trim());
      } else {
        // Jika targetSize belum diisi, varian olahraga dinamis tidak membatasi potensi estimasi kain
        continue;
      }
    } else {
      // Fallback jenis seragam masa depan: gunakan ukuran item jika ada, atau ukuran target
      const sizeToCheck = item.size && item.size !== UNIFORM_KAIN_SIZE ? item.size : (targetSize?.trim() || UNIFORM_KAIN_SIZE);
      availableStock = getVariantStockQuantity(variantRow, sizeToCheck);
    }

    const possibleForThisItem = Math.floor(availableStock / item.quantity);
    if (possibleForThisItem < maxPossible) {
      maxPossible = possibleForThisItem;
      bottleneckName = item.variantName;
    }
  }

  const finalMax = maxPossible === Infinity ? 0 : Math.max(0, maxPossible);
  const reason = finalMax === 0 && bottleneckName
    ? `Stok bahan "${bottleneckName}" tidak mencukupi untuk perakitan.`
    : null;

  return {
    maxPossible: finalMax,
    bottleneckName,
    reason,
  };
}

/** Helper kompatibel mundur untuk kalkulasi potensi rakit tunggal */
export function calculateUniformAssemblyPotential(
  pkg: UniformPackageRow,
  variants: UniformVariantRow[],
  targetSize?: string
): number {
  return calculateUniformAssemblyPotentialDetails(pkg, variants, targetSize).maxPossible;
}
