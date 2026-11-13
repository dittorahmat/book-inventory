import type { UniformPackageRow, UniformVariantRow } from "../components/uniform/uniform-admin-api";

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
export function calculateUniformAssemblyPotential(
  pkg: UniformPackageRow,
  variants: UniformVariantRow[],
  targetSize?: string
): number {
  if (!pkg.bom || pkg.bom.length === 0) return 0;

  let maxPossible = Infinity;

  for (const item of pkg.bom) {
    if (item.quantity <= 0) continue;

    const variantRow = variants.find((v) => v.variant.id === item.variantId);
    if (!variantRow) return 0;

    let availableStock = 0;

    if (item.kind === "kain_harian") {
      // Kain harian menggunakan ukuran statis '—'
      const stockEntry = variantRow.stock.find((s) => s.size === "—");
      availableStock = stockEntry ? stockEntry.quantity : variantRow.stock.reduce((acc, s) => acc + s.quantity, 0);
    } else if (item.kind === "olahraga") {
      // Jika ukuran sudah spesifik di BOM selain '—'
      if (item.size && item.size !== "—") {
        const stockEntry = variantRow.stock.find((s) => s.size === item.size);
        availableStock = stockEntry?.quantity ?? 0;
      } else if (targetSize && targetSize.trim()) {
        // Jika ukuran dinamis di-override oleh input pengguna
        const cleanSize = targetSize.trim();
        const stockEntry = variantRow.stock.find((s) => s.size.toLowerCase() === cleanSize.toLowerCase());
        availableStock = stockEntry?.quantity ?? 0;
      } else {
        // Jika targetSize belum diisi, varian olahraga dinamis tidak membatasi potensi estimasi kain
        continue;
      }
    }

    const possibleForThisItem = Math.floor(availableStock / item.quantity);
    if (possibleForThisItem < maxPossible) {
      maxPossible = possibleForThisItem;
    }
  }

  return maxPossible === Infinity ? 0 : Math.max(0, maxPossible);
}
