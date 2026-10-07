import { eq } from "drizzle-orm";
import { db } from "../../db";
import { books, systemSettings } from "../../db/schema";
import { currentAcademicYear, isWIBOnOrAfter, todayWIB } from "../../lib/wib-time";
import { effectiveSellPrice } from "../../lib/book-pricing";
import type { SatuanOverride, SatuanStatus } from "../../lib/portal-types";

export type { SatuanOverride, SatuanStatus } from "../../lib/portal-types";

/** Kunci pengaturan cut-off order satuan (design D7). */
export const openFromKey = (academicYear: string) => `satuan_open_from:${academicYear}`;
export const overrideKey = (academicYear: string) => `satuan_override:${academicYear}`;

const readSetting = async (key: string): Promise<string | null> => {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  return rows[0]?.value ?? null;
};

const writeSetting = async (key: string, value: string, description: string) =>
  db.insert(systemSettings).values({ key, value, description, updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: systemSettings.key, set: { value, description, updatedAt: new Date().toISOString() } });

/**
 * Status openness order satuan untuk satu tahun ajaran.
 * Urutan evaluasi: override manual → tanggal efektif WIB → default tertutup.
 */
export async function getSatuanStatus(
  academicYear: string,
  now: Date = new Date()
): Promise<SatuanStatus> {
  const today = todayWIB(now);
  const openFrom = await readSetting(openFromKey(academicYear));
  const rawOverride = await readSetting(overrideKey(academicYear));
  const override: SatuanOverride | null =
    rawOverride === "open" || rawOverride === "closed" ? rawOverride : null;

  const open = override === "open" || (!override && !!openFrom && isWIBOnOrAfter(today, openFrom));
  const reason =
    override === "open"
      ? "Order satuan dipaksa buka oleh admin."
      : override === "closed"
        ? "Order satuan dipaksa tutup oleh admin."
        : !openFrom
          ? "Order satuan belum dibuka untuk tahun ajaran ini."
          : today < openFrom
            ? `Order satuan dibuka mulai ${openFrom}.`
            : `Order satuan terbuka sejak ${openFrom}.`;
  return { academicYear, open, todayWIB: today, openFrom: openFrom ?? null, override, reason };
}

/** Simpan tanggal efektif pembuka order satuan (format YYYY-MM-DD). */
export async function setSatuanOpenFrom(
  academicYear: string,
  dateIso: string
): Promise<SatuanStatus> {
  await writeSetting(
    openFromKey(academicYear),
    dateIso,
    `Tanggal buka order satuan tahun ajaran ${academicYear}`
  );
  return getSatuanStatus(academicYear);
}

/** Simpan override manual; null berarti kembali ke aturan tanggal. */
export async function setSatuanOverride(
  academicYear: string,
  override: SatuanOverride | null
): Promise<SatuanStatus> {
  const key = overrideKey(academicYear);
  if (override === null) {
    await db.delete(systemSettings).where(eq(systemSettings.key, key));
  } else {
    await writeSetting(
      key,
      override,
      `Override manual order satuan tahun ajaran ${academicYear}`
    );
  }
  return getSatuanStatus(academicYear);
}

/** Status untuk tahun ajaran berjalan, dipakai form publik tanpa parameter tahun. */
export function getCurrentSatuanStatus(now: Date = new Date()): Promise<SatuanStatus> {
  return getSatuanStatus(currentAcademicYear(now), now);
}

export interface SatuanCatalogBook {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  category: string | null;
  coverUrl: string | null;
  sellPrice: number;
}

export interface SatuanCatalog {
  open: boolean;
  status: SatuanStatus;
  books: SatuanCatalogBook[];
}

/**
 * Kemampuan cut-off + katalog dalam satu panggilan: status dievaluasi sekali,
 * lalu buku di-query hanya saat terbuka — katalog basi setelah cut-off flip
 * tidak mungkin terjadi.
 */
export async function getSatuanCatalogIfOpen(academicYear?: string): Promise<SatuanCatalog> {
  const year = academicYear?.trim() || currentAcademicYear(new Date());
  const status = await getSatuanStatus(year);
  if (!status.open) {
    return { open: false, status, books: [] };
  }
  const rows = await db
    .select({
      id: books.id,
      isbn: books.isbn,
      title: books.title,
      author: books.author,
      publisher: books.publisher,
      category: books.category,
      coverUrl: books.coverUrl,
      price: books.price,
      sellPrice: books.sellPrice,
    })
    .from(books)
    .orderBy(books.title);
  return { open: true, status, books: rows.map((b: SatuanCatalogBook & { price: number }) => ({ ...b, sellPrice: effectiveSellPrice(b) })) };
}
