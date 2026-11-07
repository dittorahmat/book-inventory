import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db";
import { bookPackageItems, bookPackages, books, bookSuppliers } from "../db/schema";
import { chunkRows } from "./lib/d1-write";

export interface PreschoolBookItemDef {
  title: string;
  isbn: string;
  publisher: string;
  sellPrice: number;
  discountRate: number;
}

export const PRESCHOOL_BOOKS: PreschoolBookItemDef[] = [
  // PG
  { title: "I LEAP NURSERY ENGLISH COURSEBOOK A", isbn: "BK-PG-ILEAP-ENG-CB-A", publisher: "PELANGI BOOKS", sellPrice: 42000, discountRate: 0.2 },
  { title: "I LEAP NURSERY ENGLISH ACTIVITY BOOK A", isbn: "BK-PG-ILEAP-ENG-AB-A", publisher: "PELANGI BOOKS", sellPrice: 35000, discountRate: 0.2 },
  { title: "I LEAP NURSERY ENGLISH COURSEBOOK B", isbn: "BK-PG-ILEAP-ENG-CB-B", publisher: "PELANGI BOOKS", sellPrice: 42000, discountRate: 0.2 },
  { title: "I LEAP NURSERY ENGLISH ACTIVITY BOOK B", isbn: "BK-PG-ILEAP-ENG-AB-B", publisher: "PELANGI BOOKS", sellPrice: 35000, discountRate: 0.2 },
  { title: "I LEAP NURSERY MATHS COURSEBOOK A", isbn: "BK-PG-ILEAP-MTH-CB-A", publisher: "PELANGI BOOKS", sellPrice: 42000, discountRate: 0.2 },
  { title: "I LEAP NURSERY MATHS ACIVITY BOOK A", isbn: "BK-PG-ILEAP-MTH-AB-A", publisher: "PELANGI BOOKS", sellPrice: 35000, discountRate: 0.2 },
  { title: "I LEAP NURSERY MATHS COURSEBOOK B", isbn: "BK-PG-ILEAP-MTH-CB-B", publisher: "PELANGI BOOKS", sellPrice: 42000, discountRate: 0.2 },
  { title: "I LEAP NURSERY MATHS ACIVITY BOOK B", isbn: "BK-PG-ILEAP-MTH-AB-B", publisher: "PELANGI BOOKS", sellPrice: 35000, discountRate: 0.2 },

  // K1
  { title: "I LEAP K1 ENGLISH COURSEBOOK A", isbn: "BK-K1-ILEAP-ENG-CB-A", publisher: "PELANGI BOOKS", sellPrice: 42000, discountRate: 0.2 },
  { title: "I LEAP K1 ENGLISH COURSEBOOK B", isbn: "BK-K1-ILEAP-ENG-CB-B", publisher: "PELANGI BOOKS", sellPrice: 42000, discountRate: 0.2 },
  { title: "LEARNING PARK - MATHS BOOK 1 (BI) INDO", isbn: "BK-K1-LP-MATH-1", publisher: "PELANGI BOOKS", sellPrice: 38000, discountRate: 0.2 },
  { title: "LEARNING PARK - MATHS BOOK 2 (BI) INDO", isbn: "BK-K1-LP-MATH-2", publisher: "PELANGI BOOKS", sellPrice: 38000, discountRate: 0.2 },
  { title: "MY PRESCHOOL WORLD - PHONICS ACT BOOK 1", isbn: "BK-K1-MPW-PHON-AB-1", publisher: "PELANGI BOOKS", sellPrice: 30000, discountRate: 0.2 },
  { title: "MY PRESCHOOL WORLD - PHONICS ACT BOOK 2", isbn: "BK-K1-MPW-PHON-AB-2", publisher: "PELANGI BOOKS", sellPrice: 30000, discountRate: 0.2 },

  // K2
  { title: "I LEAP K2 ENGLISH COURSEBOOK A", isbn: "BK-K2-ILEAP-ENG-CB-A", publisher: "PELANGI BOOKS", sellPrice: 42000, discountRate: 0.2 },
  { title: "I LEAP K2 ENGLISH COURSEBOOK B", isbn: "BK-K2-ILEAP-ENG-CB-B", publisher: "PELANGI BOOKS", sellPrice: 42000, discountRate: 0.2 },
  { title: "Yok!Hop Onto Math Reader 3", isbn: "BK-K2-YOKHOP-MATH-3", publisher: "PELANGI BOOKS", sellPrice: 40000, discountRate: 0.2 },
  { title: "Yok!Hop Onto Math Reader 4", isbn: "BK-K2-YOKHOP-MATH-4", publisher: "PELANGI BOOKS", sellPrice: 40000, discountRate: 0.2 },
  { title: "MY PRESCHOOL WORLD - PHONICS READER 3", isbn: "BK-K2-MPW-PHON-RB-3", publisher: "PELANGI BOOKS", sellPrice: 37000, discountRate: 0.2 },
  { title: "MY PRESCHOOL WORLD - PHONICS READER 4", isbn: "BK-K2-MPW-PHON-RB-4", publisher: "PELANGI BOOKS", sellPrice: 37000, discountRate: 0.2 },

  // Shared Diniyah
  { title: "Bahasa Arab Preschool", isbn: "BK-PRE-ARAB", publisher: "PT Segara Makmur Sejati", sellPrice: 35000, discountRate: 0.28 },
  { title: "Hafalan Hadist Pendek", isbn: "BK-PRE-HADIST", publisher: "DARSYAFI'I", sellPrice: 25000, discountRate: 0.35 },
  { title: "Do'a-Do'a Pilihan", isbn: "BK-PRE-DOA", publisher: "DARSYAFI'I", sellPrice: 25000, discountRate: 0.35 },
  { title: "Tuntunan Wudhu dan Sholat", isbn: "BK-PRE-SHOLAT", publisher: "DARSYAFI'I", sellPrice: 30000, discountRate: 0.35 },
  { title: "Qoidah Nurroniyah", isbn: "BK-PRE-NURRONIYAH", publisher: "PT Manzilla Makmur", sellPrice: 35000, discountRate: 0.2 },
  { title: "Weekly Progress Report Preschool", isbn: "BK-PRE-WPR", publisher: "CV Mega Wira Perkasa", sellPrice: 25000, discountRate: 0.2 },
];

export async function seedPreschoolPackages(targetDb: AppDatabase) {
  const now = new Date().toISOString();
  let createdBooksCount = 0;

  // 1. Insert buku-buku baru yang belum ada
  const existingBooks = await targetDb.select().from(books);
  const bookTitleMap = new Map(existingBooks.map((b) => [b.title.toUpperCase(), b.id]));

  for (const item of PRESCHOOL_BOOKS) {
    if (!bookTitleMap.has(item.title.toUpperCase())) {
      const bookId = `b-pre-${item.isbn.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const buyPrice = Math.round(item.sellPrice * (1 - item.discountRate));
      await targetDb
        .insert(books)
        .values({
          id: bookId,
          isbn: item.isbn,
          title: item.title,
          author: "Tim Kurikulum",
          publisher: item.publisher,
          price: item.sellPrice,
          sellPrice: item.sellPrice,
          buyPrice,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
      bookTitleMap.set(item.title.toUpperCase(), bookId);
      createdBooksCount++;

      // Hubungkan ke supplier pelangi / diniyah
      const supplierId = item.publisher === "PELANGI BOOKS" ? "sup-pelangi" : "sup-darsyafii";
      await targetDb
        .insert(bookSuppliers)
        .values({
          bookId,
          supplierId,
          createdAt: now,
        })
        .onConflictDoNothing();
    }
  }

  // 2. Buat Paket PG, K1, K2
  const packageDefs = [
    {
      id: "pkg-pg-2026-2027",
      code: "PKG-PG-2026-2027",
      name: "Paket Buku Play Group TA 2026/2027",
      gradeLevel: "PG",
      curriculumType: "international" as const,
      academicYear: "2026/2027",
      items: [
        "I LEAP NURSERY ENGLISH COURSEBOOK A",
        "I LEAP NURSERY ENGLISH ACTIVITY BOOK A",
        "I LEAP NURSERY ENGLISH COURSEBOOK B",
        "I LEAP NURSERY ENGLISH ACTIVITY BOOK B",
        "I LEAP NURSERY MATHS COURSEBOOK A",
        "I LEAP NURSERY MATHS ACIVITY BOOK A",
        "I LEAP NURSERY MATHS COURSEBOOK B",
        "I LEAP NURSERY MATHS ACIVITY BOOK B",
        "Bahasa Arab Preschool",
        "Hafalan Hadist Pendek",
        "Do'a-Do'a Pilihan",
        "Tuntunan Wudhu dan Sholat",
        "Qoidah Nurroniyah",
        "Weekly Progress Report Preschool",
      ],
    },
    {
      id: "pkg-k1-2026-2027",
      code: "PKG-K1-2026-2027",
      name: "Paket Buku Kindergarten 1 (TK A) TA 2026/2027",
      gradeLevel: "K1",
      curriculumType: "international" as const,
      academicYear: "2026/2027",
      items: [
        "I LEAP K1 ENGLISH COURSEBOOK A",
        "I LEAP K1 ENGLISH COURSEBOOK B",
        "LEARNING PARK - MATHS BOOK 1 (BI) INDO",
        "LEARNING PARK - MATHS BOOK 2 (BI) INDO",
        "MY PRESCHOOL WORLD - PHONICS ACT BOOK 1",
        "MY PRESCHOOL WORLD - PHONICS ACT BOOK 2",
        "Bahasa Arab Preschool",
        "Hafalan Hadist Pendek",
        "Do'a-Do'a Pilihan",
        "Tuntunan Wudhu dan Sholat",
        "Qoidah Nurroniyah",
        "Weekly Progress Report Preschool",
      ],
    },
    {
      id: "pkg-k2-2026-2027",
      code: "PKG-K2-2026-2027",
      name: "Paket Buku Kindergarten 2 (TK B) TA 2026/2027",
      gradeLevel: "K2",
      curriculumType: "international" as const,
      academicYear: "2026/2027",
      items: [
        "I LEAP K2 ENGLISH COURSEBOOK A",
        "I LEAP K2 ENGLISH COURSEBOOK B",
        "Yok!Hop Onto Math Reader 3",
        "Yok!Hop Onto Math Reader 4",
        "MY PRESCHOOL WORLD - PHONICS READER 3",
        "MY PRESCHOOL WORLD - PHONICS READER 4",
        "Bahasa Arab Preschool",
        "Hafalan Hadist Pendek",
        "Do'a-Do'a Pilihan",
        "Tuntunan Wudhu dan Sholat",
        "Qoidah Nurroniyah",
        "Weekly Progress Report Preschool",
      ],
    },
  ];

  let createdPackagesCount = 0;
  for (const pkg of packageDefs) {
    const existing = await targetDb.select().from(bookPackages).where(eq(bookPackages.code, pkg.code));
    if (existing.length === 0) {
      await targetDb.insert(bookPackages).values({
        id: pkg.id,
        code: pkg.code,
        name: pkg.name,
        gradeLevel: pkg.gradeLevel,
        curriculumType: pkg.curriculumType,
        academicYear: pkg.academicYear,
        price: 450000,
        createdAt: now,
        updatedAt: now,
      });
      createdPackagesCount++;

      // Masukkan item ke bookPackageItems
      const packageItemRows = [];
      for (const itemTitle of pkg.items) {
        const bookId = bookTitleMap.get(itemTitle.toUpperCase());
        if (bookId) {
          packageItemRows.push({
            id: `bpi-${pkg.id}-${bookId.slice(-8)}`,
            packageId: pkg.id,
            bookId,
            quantity: 1,
            createdAt: now,
          });
        }
      }

      for (const chunk of chunkRows(packageItemRows)) {
        await targetDb.insert(bookPackageItems).values(chunk).onConflictDoNothing();
      }
    } else {
      createdPackagesCount++;
    }
  }

  return { createdPackagesCount, createdBooksCount };
}
