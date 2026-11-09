import type { AppDatabase } from "../db";
import { bookPackageItems, bookPackages, bookStocks } from "../db/schema";
import { moveInventoryStock } from "./services/stock";
import { kitBomWithoutWpr } from "./services/pricing";
import { eq } from "drizzle-orm";
import type { WriteDeps } from "./lib/d1-write";

export interface AutoKitResult {
  schoolId: string;
  packageId: string;
  packageName: string;
  quantityAssembled: number;
}

export interface AutoKitSummary {
  assembledPackages: AutoKitResult[];
  totalPackagesAssembled: number;
  totalBooksConsumed: number;
}

/**
 * Runner kitting otomatis untuk merakit paket buku secara maksimal
 * dari stok buku satuan di `book_stocks` ke `package_stocks` sesuai BOM.
 * Mengikuti aturan arsitektur single-writer moveInventoryStock.
 */
export async function autoKitMaxPackages(
  targetDb: AppDatabase,
  schoolIds: string[],
  deps: WriteDeps = {}
): Promise<AutoKitSummary> {
  const assembledPackages: AutoKitResult[] = [];
  let totalPackagesAssembled = 0;
  let totalBooksConsumed = 0;

  for (const schoolId of schoolIds) {
    // 1. Ambil seluruh definisi paket dan komponen BOM
    const allPackages = await targetDb.select().from(bookPackages);
    if (allPackages.length === 0) continue;

    const allBoms = await targetDb
      .select({
        packageId: bookPackageItems.packageId,
        bookId: bookPackageItems.bookId,
        quantity: bookPackageItems.quantity,
      })
      .from(bookPackageItems);

    const bomsByPackage = new Map<string, Array<{ bookId: string; quantity: number }>>();
    for (const b of allBoms) {
      const list = bomsByPackage.get(b.packageId) ?? [];
      list.push(b);
      bomsByPackage.set(b.packageId, list);
    }

    // 2. Ambil stok satuan aktif untuk sekolah ini
    const stocks = await targetDb
      .select({
        bookId: bookStocks.bookId,
        available: bookStocks.availableQuantity,
      })
      .from(bookStocks)
      .where(eq(bookStocks.schoolId, schoolId));

    const stockMap = new Map<string, number>(stocks.map((s) => [s.bookId, s.available]));

    // 3. Iterasi tiap paket dan hitung batas perakitan maksimum
    for (const pkg of allPackages) {
      const rawBom = bomsByPackage.get(pkg.id) ?? [];
      const kitBom = kitBomWithoutWpr(rawBom);
      if (kitBom.length === 0) continue;

      // Cek stok setiap komponen
      let maxKits = Number.MAX_SAFE_INTEGER;
      for (const comp of kitBom) {
        const available = stockMap.get(comp.bookId) ?? 0;
        const possible = Math.floor(available / comp.quantity);
        if (possible < maxKits) {
          maxKits = possible;
        }
      }

      if (maxKits <= 0 || maxKits === Number.MAX_SAFE_INTEGER) continue;

      // Potong stok lokal di map dan jalankan mutasi via moveInventoryStock
      for (const comp of kitBom) {
        const consumed = comp.quantity * maxKits;
        stockMap.set(comp.bookId, (stockMap.get(comp.bookId) ?? 0) - consumed);

        const debitRes = await moveInventoryStock(
          targetDb,
          {
            movementType: "handover", // serap buku satuan
            itemType: "loose",
            bookId: comp.bookId,
            schoolId,
            quantity: consumed,
          },
          deps
        );
        if (!debitRes.ok) {
          throw new Error(`Gagal memotong stok komponen ${comp.bookId} untuk perakitan ${pkg.id}: ${debitRes.message}`);
        }
        totalBooksConsumed += consumed;
      }

      const creditRes = await moveInventoryStock(
        targetDb,
        {
          movementType: "assembly", // tambah saldo paket
          itemType: "package",
          packageId: pkg.id,
          schoolId,
          quantity: maxKits,
        },
        deps
      );
      if (!creditRes.ok) {
        throw new Error(`Gagal menambah saldo stok paket ${pkg.id}: ${creditRes.message}`);
      }

      assembledPackages.push({
        schoolId,
        packageId: pkg.id,
        packageName: pkg.name,
        quantityAssembled: maxKits,
      });
      totalPackagesAssembled += maxKits;
    }
  }

  return {
    assembledPackages,
    totalPackagesAssembled,
    totalBooksConsumed,
  };
}
