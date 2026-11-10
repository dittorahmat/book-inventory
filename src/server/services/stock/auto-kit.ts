import type { AppDatabase } from "../../../db";
import { bookPackageItems, bookPackages, bookStocks, books } from "../../../db/schema";
import { moveInventoryStock } from "./movement";
import { kitBomWithoutWpr } from "../pricing";
import { eq } from "drizzle-orm";
import type { WriteDeps } from "../../lib/d1-write";

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
  dryRun?: boolean;
}

export interface AutoKitOptions {
  dryRun?: boolean;
  deps?: WriteDeps;
}

/**
 * Runner kitting otomatis untuk merakit paket buku secara maksimal
 * dari stok buku satuan di `book_stocks` ke `package_stocks` sesuai BOM.
 * Mengikuti aturan arsitektur single-writer moveInventoryStock dengan movementType: 'assembly'.
 */
export async function autoKitMaxPackages(
  targetDb: AppDatabase,
  schoolIds: string[],
  options: AutoKitOptions = {}
): Promise<AutoKitSummary> {
  const { dryRun = false, deps = {} } = options;
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
        title: books.title,
        isbn: books.isbn,
      })
      .from(bookPackageItems)
      .innerJoin(books, eq(bookPackageItems.bookId, books.id));

    const bomsByPackage = new Map<string, Array<{ bookId: string; quantity: number; title: string; isbn: string }>>();
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

      // Cek ketersediaan setiap komponen
      let maxKits = Number.MAX_SAFE_INTEGER;
      for (const comp of kitBom) {
        const available = stockMap.get(comp.bookId) ?? 0;
        const possible = Math.floor(available / comp.quantity);
        if (possible < maxKits) {
          maxKits = possible;
        }
      }

      if (maxKits <= 0 || maxKits === Number.MAX_SAFE_INTEGER) continue;

      // Simulasi pengurangan stok di memori untuk mencegah over-commitment antar-paket
      for (const comp of kitBom) {
        const consumed = comp.quantity * maxKits;
        const current = stockMap.get(comp.bookId) ?? 0;
        stockMap.set(comp.bookId, Math.max(0, current - consumed));
        totalBooksConsumed += consumed;
      }

      if (!dryRun) {
        // Debit komponen BOM dengan semantik assembly
        for (const comp of kitBom) {
          const consumed = comp.quantity * maxKits;
          const debitRes = await moveInventoryStock(
            targetDb,
            {
              movementType: "assembly",
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
        }

        // Credit stok paket dengan semantik assembly
        const creditRes = await moveInventoryStock(
          targetDb,
          {
            movementType: "assembly",
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
    dryRun,
  };
}
