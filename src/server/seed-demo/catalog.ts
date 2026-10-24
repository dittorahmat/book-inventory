import { and, eq, sql } from "drizzle-orm";
import { WPR_PRICE } from "../../lib/wpr";
import {
  bookItems,
  bookPackageItems,
  bookPackages,
  books,
  packageItems,
} from "../../db/schema";
import { ensurePackageHasWpr } from "../services/wpr";
import type { SeedContext } from "./context";

export const BOOK_LIST = [
  { id: "b-math-1", isbn: "978-1108746489", title: "Cambridge Primary Mathematics Learner's Book 1", author: "Cherri Moseley", publisher: "Cambridge University Press", category: "Cambridge International", publishYear: 2021, price: 120000, buyPrice: 102000, sellPrice: 120000 },
  { id: "b-sci-1", isbn: "978-1108742726", title: "Cambridge Primary Science Learner's Book 1", author: "Jon Board", publisher: "Cambridge University Press", category: "Cambridge International", publishYear: 2021, price: 115000, buyPrice: 98000, sellPrice: 115000 },
  { id: "b-eng-1", isbn: "978-1108719292", title: "Cambridge Global English Learner's Book 1", author: "Elly Schottman", publisher: "Cambridge University Press", category: "Cambridge International", publishYear: 2021, price: 130000, buyPrice: 110500, sellPrice: 130000 },
  { id: "b-pai-1", isbn: "978-6022444985", title: "Pendidikan Agama Islam dan Budi Pekerti Kelas 1", author: "Drs. M. Daud", publisher: "Kementerian Agama & Kemendikbud", category: "Agama & Karakter", publishYear: 2022, price: 55000, buyPrice: 47000, sellPrice: 55000 },
  { id: "b-bindo-1", isbn: "978-6022444992", title: "Bahasa Indonesia: Aku Bisa! Kelas 1", author: "Sofie Dewayani", publisher: "Pusat Kurikulum dan Perbukuan", category: "Nasional", publishYear: 2022, price: 60000, buyPrice: 51000, sellPrice: 60000 },
  { id: "b-ppkn-1", isbn: "978-6022445005", title: "Pendidikan Pancasila Kelas 1", author: "Elisa Seftriyana", publisher: "Kemendikbudristek", category: "Nasional", publishYear: 2022, price: 50000, buyPrice: 42500, sellPrice: 50000 },
  { id: "b-arab-1", isbn: "978-6022445012", title: "Bahasa Arab Dasar untuk Anak Shalih Kelas 1", author: "Tim Asatidzah Al Wildan", publisher: "Pustaka Al Wildan", category: "Diniyyah", publishYear: 2023, price: 65000, buyPrice: 55000, sellPrice: 65000 },
  { id: "b-tahfidz-1", isbn: "978-6022445029", title: "Buku Panduan Mutaba'ah Tahfidz Al-Qur'an Juz 30", author: "Lembaga Tahfidz Al Wildan", publisher: "Pustaka Al Wildan", category: "Tahfidz", publishYear: 2023, price: 75000, buyPrice: 64000, sellPrice: 75000 },
  { id: "b-math-2", isbn: "978-1108746496", title: "Cambridge Primary Mathematics Learner's Book 2", author: "Cherri Moseley", publisher: "Cambridge University Press", category: "Cambridge International", publishYear: 2021, price: 95000, buyPrice: 81000, sellPrice: 95000 },
  { id: "b-sci-2", isbn: "978-1108742733", title: "Cambridge Primary Science Learner's Book 2", author: "Jon Board", publisher: "Cambridge University Press", category: "Cambridge International", publishYear: 2021, price: 90000, buyPrice: 76500, sellPrice: 90000 },
  { id: "b-eng-2", isbn: "978-1108719308", title: "Cambridge Global English Learner's Book 2", author: "Elly Schottman", publisher: "Cambridge University Press", category: "Cambridge International", publishYear: 2021, price: 110000, buyPrice: 93500, sellPrice: 110000 },
  { id: "b-pai-2", isbn: "978-6022445036", title: "Pendidikan Agama Islam dan Budi Pekerti Kelas 2", author: "Drs. M. Daud", publisher: "Kementerian Agama & Kemendikbud", category: "Agama & Karakter", publishYear: 2022, price: 55000, buyPrice: 46500, sellPrice: 55000 },
];

export const PACKAGE_DATA = [
  {
    id: "pkg-sd1-int",
    code: "PKG-SD1-INT",
    name: "Paket Kelas 1 SD Internasional (Cambridge + Diniyyah)",
    gradeLevel: "1",
    curriculumType: "international" as const,
    academicYear: "2026/2027",
    description: "Paket lengkap 8 buku mata pelajaran inti Cambridge, Bahasa Indonesia, Pendidikan Agama Islam, Bahasa Arab, dan Tahfidz.",
  },
  {
    id: "pkg-sd1-nas",
    code: "PKG-SD1-NAS",
    name: "Paket Kelas 1 SD Nasional Plus",
    gradeLevel: "1",
    curriculumType: "national" as const,
    academicYear: "2026/2027",
    description: "Paket kurikulum nasional terpadu dengan penguatan PAI dan Tahfidz Quran.",
  },
  {
    id: "pkg-sd2-int",
    code: "PKG-SD2-INT",
    name: "Paket Kelas 2 SD Internasional (Cambridge)",
    gradeLevel: "2",
    curriculumType: "international" as const,
    academicYear: "2026/2027",
    description: "Paket lanjutan Cambridge Mathematics, Science, English, dan PAI Kelas 2.",
  },
  {
    id: "pkg-sd2-nas",
    code: "PKG-SD2-NAS",
    name: "Paket Kelas 2 SD Nasional Plus",
    gradeLevel: "2",
    curriculumType: "national" as const,
    academicYear: "2026/2027",
    description: "Paket lanjutan kurikulum nasional Kelas 2 dengan penguatan PAI dan Tahfidz Quran.",
  },
];

export const BOM_BY_PACKAGE: Record<string, string[]> = {
  "pkg-sd1-int": ["b-math-1", "b-sci-1", "b-eng-1", "b-pai-1", "b-bindo-1", "b-ppkn-1", "b-arab-1", "b-tahfidz-1"],
  "pkg-sd1-nas": ["b-pai-1", "b-bindo-1", "b-ppkn-1", "b-tahfidz-1"],
  "pkg-sd2-int": ["b-math-2", "b-sci-2", "b-eng-2", "b-pai-2", "b-bindo-1", "b-ppkn-1", "b-arab-1", "b-tahfidz-1"],
  "pkg-sd2-nas": ["b-pai-2", "b-bindo-1", "b-ppkn-1", "b-tahfidz-1"],
};

const BOM_ID_PREFIX: Record<string, string> = {
  "pkg-sd1-int": "bom-sd1int",
  "pkg-sd1-nas": "bom-sd1nas",
  "pkg-sd2-int": "bom-sd2int",
  "pkg-sd2-nas": "bom-sd2nas",
};

const sellByBookId = new Map(BOOK_LIST.map((b) => [b.id, b.sellPrice]));

/** Harga paket = jumlah harga jual komponen BOM (WPR ditambahkan terpisah). */
export const computePackagePrice = (packageId: string) =>
  (BOM_BY_PACKAGE[packageId] ?? []).reduce((sum, bookId) => sum + (sellByBookId.get(bookId) ?? 0), 0);

export async function seedCatalog({ db: targetDb, now }: SeedContext) {
  // Upsert idempotent agar buku demo baru (mis. Kelas 2) masuk ke DB lama juga.
  // Harga hanya di-backfill untuk buku yang masih 0 agar edit manual tidak tertimpa rerun.
  for (const b of BOOK_LIST) {
    await targetDb
      .insert(books)
      .values({ ...b, createdAt: now, updatedAt: now })
      .onConflictDoNothing();
    await targetDb
      .update(books)
      .set({ price: b.price, buyPrice: b.buyPrice, sellPrice: b.sellPrice, updatedAt: now })
      .where(and(eq(books.id, b.id), eq(books.price, 0)));
    await targetDb
      .update(books)
      .set({ buyPrice: b.buyPrice, sellPrice: b.sellPrice, updatedAt: now })
      .where(
        and(
          eq(books.id, b.id),
          sql`${books.price} > 0`,
          sql`(${books.sellPrice} IS NULL OR ${books.sellPrice} = 0)`
        )
      );
  }

  for (const p of PACKAGE_DATA) {
    await targetDb
      .insert(bookPackages)
      .values({ ...p, price: computePackagePrice(p.id), createdAt: now, updatedAt: now })
      .onConflictDoNothing();
    await targetDb
      .update(bookPackages)
      .set({ price: computePackagePrice(p.id), updatedAt: now })
      .where(eq(bookPackages.id, p.id));
  }

  // BOM Components per paket (sumber kebenaran harga paket).
  for (const [packageId, bookIds] of Object.entries(BOM_BY_PACKAGE)) {
    const prefix = BOM_ID_PREFIX[packageId];
    for (const bId of bookIds) {
      await targetDb.insert(bookPackageItems).values({
        id: `${prefix}-${bId}`,
        packageId,
        bookId: bId,
        quantity: 1,
        createdAt: now,
      }).onConflictDoNothing();
    }
    // WPR wajib di semua BOM paket (cermin migrasi + POST /api/packages).
    await ensurePackageHasWpr(targetDb, packageId);
    await targetDb
      .update(bookPackages)
      .set({ price: computePackagePrice(packageId) + WPR_PRICE, updatedAt: now })
      .where(eq(bookPackages.id, packageId));
  }

  // Stok satuan lepas di gudang pusat/kampus 1. Insert per baris agar re-seed
  // mengisi kembali baris demo yang hilang di database lama.
  for (const b of BOOK_LIST) {
    for (let i = 0; i < 20; i++) {
      await targetDb.insert(bookItems).values({
        id: `bi-loose-${b.id}-${i}`,
        bookId: b.id,
        currentSchoolId: "school-alw-1",
        barcode: `LSE-${b.isbn.slice(-4)}-${(i + 1).toString().padStart(3, "0")}`,
        condition: "new",
        status: "in_stock",
        notes: "Loose stock inventory",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    }
  }

  // Stok bundel siap serah.
  for (let i = 0; i < 15; i++) {
    await targetDb.insert(packageItems).values({
      id: `pki-sd1int-${i}`,
      packageId: "pkg-sd1-int",
      currentSchoolId: "school-alw-1",
      barcode: `PKG-ALW1-2026-${(i + 1).toString().padStart(4, "0")}`,
      status: "in_stock",
      notes: "Pre-assembled ready bundle",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }
}
