import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookPackageItems, books, studentBookOrders, systemSettings } from "../../db/schema";
import { WPR_BOOK_ID, WPR_ISBN, WPR_PRICE, WPR_TITLE } from "../../lib/wpr";
import { newWriteId, writeNow, type WriteDeps } from "../lib/d1-write";
import { readSettingsMap } from "./settings-map";

export const WPR_PRICE_SETTING_KEY = "book_wpr_price";

/** Ambil nominal harga WPR saat ini dari system_settings (fallback ke WPR_PRICE = 750000). */
export const getWprPriceSetting = async (database: AppDatabase): Promise<number> => {
  const map = await readSettingsMap(database);
  const raw = map[WPR_PRICE_SETTING_KEY];
  if (!raw) return WPR_PRICE;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : WPR_PRICE;
};

/** Simpan nominal harga WPR ke system_settings dan sinkronkan ke katalog buku WPR (idempoten). */
export const saveWprPriceSetting = async (
  database: AppDatabase,
  price: number,
  deps?: WriteDeps
): Promise<number> => {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Nominal WPR harus berupa angka positif.");
  }
  const now = writeNow(deps);
  await database
    .insert(systemSettings)
    .values({
      key: WPR_PRICE_SETTING_KEY,
      value: String(price),
      description: "Nominal WPR (Weekly Progress Report)",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: String(price), updatedAt: now },
    });

  // Sinkronkan ke baris buku WPR
  await ensureWprBook(database, deps, price);
  return price;
};

/** Pastikan baris buku WPR ada dan tersinkronkan atribut publiknya (idempoten). */
export const ensureWprBook = async (
  database: AppDatabase,
  deps?: WriteDeps,
  overridePrice?: number
): Promise<void> => {
  const now = writeNow(deps);
  const activePrice = overridePrice ?? (await getWprPriceSetting(database));
  await database
    .insert(books)
    .values({
      id: WPR_BOOK_ID, isbn: WPR_ISBN, title: WPR_TITLE,
      publicTitle: WPR_TITLE,
      author: "Al Wildan", publisher: "Al Wildan",
      price: activePrice, buyPrice: 0, sellPrice: activePrice,
      createdAt: now, updatedAt: now,
    })
    .onConflictDoUpdate({
      target: books.id,
      set: {
        publicTitle: WPR_TITLE,
        price: activePrice,
        sellPrice: activePrice,
        updatedAt: now,
      },
    });
};

/** Pastikan satu paket mengandung WPR di BOM (idempoten). */
export const ensurePackageHasWpr = async (database: AppDatabase, packageId: string, deps?: WriteDeps): Promise<void> => {
  await ensureWprBook(database, deps);
  const existing = await database
    .select({ id: bookPackageItems.id })
    .from(bookPackageItems)
    .where(and(eq(bookPackageItems.packageId, packageId), eq(bookPackageItems.bookId, WPR_BOOK_ID)))
    .limit(1);
  if (existing.length > 0) return;
  await database.insert(bookPackageItems).values({
    id: newWriteId(deps), packageId, bookId: WPR_BOOK_ID, quantity: 1, createdAt: writeNow(deps),
  });
};

/** Jumlah order paket murid (reguler maupun beasiswa/free): >0 berarti bebas WPR. */
export const countPackageOrders = async (database: AppDatabase, studentId: string): Promise<number> => {
  const rows = await database
    .select({ n: sql<number>`count(*)` })
    .from(studentBookOrders)
    .where(and(eq(studentBookOrders.studentId, studentId), isNotNull(studentBookOrders.packageId)));
  return rows[0]?.n ?? 0;
};
