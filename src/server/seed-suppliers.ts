import type { AppDatabase } from "../db";
import { bookSuppliers, books, suppliers } from "../db/schema";
import { chunkRows } from "./lib/d1-write";

export interface SupplierSeedDefinition {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  type: "book" | "uniform" | "all";
  publisherKeywords: string[];
  titleKeywords?: string[];
}

export const OFFICIAL_SUPPLIERS: SupplierSeedDefinition[] = [
  {
    id: "sup-cnl",
    code: "SUP-CNL",
    name: "PT Chandra Naya Laksana (CNL)",
    contactPerson: "Fil Rahman",
    phone: "0896 0274 4493",
    address: "Distributor Resmi Scholastic & Cambridge Books (Diskon 40%)",
    type: "book",
    publisherKeywords: ["SCHOLASTIC", "Cambridge"],
    titleKeywords: ["PRIME MATH", "SCIENCE", "ENGLISH STUDENT"],
  },
  {
    id: "sup-mentari",
    code: "SUP-MENTARI",
    name: "PT Mentari Books Utama",
    contactPerson: "Ervan",
    phone: "0856 4846 6686",
    address: "Cambridge Secondary Science & Physics/Chemistry/Biology (Diskon 25%)",
    type: "book",
    publisherKeywords: ["Mentari", "Cambridge"],
    titleKeywords: ["PHYSICS", "CHEMISTRY", "BIOLOGY", "MATHEMATICS"],
  },
  {
    id: "sup-pelangi",
    code: "SUP-PELANGI",
    name: "PT Penerbitan Pelangi Indonesia",
    contactPerson: "Demi",
    phone: "0895 6303 93950",
    address: "Bank BCA 7540 3091 70 AN. PT Penerbitan Pelangi Indonesia (Diskon 20%)",
    type: "book",
    publisherKeywords: ["PELANGI BOOKS", "Pelangi"],
    titleKeywords: ["I LEAP", "YOK!HOP", "MY PRESCHOOL", "LEARNING PARK"],
  },
  {
    id: "sup-erlangga",
    code: "SUP-ERL",
    name: "PT Penerbit Erlangga Mahameru",
    contactPerson: "Fahru Rozi",
    phone: "0895 8630 8369",
    address: "Penerbit Buku Wajib Kurikulum Nasional / Diknas (Diskon 40%)",
    type: "book",
    publisherKeywords: ["ERLANGGA", "Erlangga"],
    titleKeywords: ["MATEMATIKA", "BAHASA INDONESIA", "PENDIDIKAN PANCASILA", "IPA", "IPS"],
  },
  {
    id: "sup-darsyafii",
    code: "SUP-DARSYAFII",
    name: "Pustaka Imam Asy-Syafi'i / Darsyafi'i",
    contactPerson: "Ust. Adnan",
    phone: "0811 8751 999",
    address: "Penerbit Buku Diniyyah, Akidah, Hadits, Fikih (Diskon 35%)",
    type: "book",
    publisherKeywords: ["DARSYAFI'I", "Pustaka Imam Syafi'i", "Al-Wildan Press"],
    titleKeywords: ["AKIDAH", "FIKIH", "HADIST", "SKI", "TAJWID", "TAHFIDZ"],
  },
  {
    id: "sup-segara-makmur",
    code: "SUP-SEGARA",
    name: "PT Segara Makmur Sejati",
    contactPerson: "Pak Yudi",
    phone: "0812-8899-7711",
    address: "Percetakan & Penerbit Buku Bahasa Arab Al-Wildan (Diskon 28%)",
    type: "book",
    publisherKeywords: ["SEGARA", "Al-Wildan Press"],
    titleKeywords: ["BAHASA ARAB", "DURUSUL LUGHAH", "AL-ARABIYYAH"],
  },
  {
    id: "sup-manzilla",
    code: "SUP-MANZILLA",
    name: "PT Manzilla Makmur",
    contactPerson: "Sri Mulyani",
    phone: "+62 812 1847 0996",
    address: "Percetakan Mushaf Al-Qur'an & Qoidah Nurroniyah",
    type: "book",
    publisherKeywords: ["MANZILLA", "Al-Wildan Press"],
    titleKeywords: ["AL-QUR'AN", "QURAN", "QOIDAH NURRONIYAH", "METODE TILAWAH"],
  },
  {
    id: "sup-mega-wira",
    code: "SUP-MEGAWIRA",
    name: "CV Mega Wira Perkasa",
    contactPerson: "Pak Reza",
    phone: "0813-1122-3344",
    address: "Percetakan Modul Custom & Buku Pegangan Siswa",
    type: "book",
    publisherKeywords: ["CETAK IDI DARMA", "PERCETAKAN HERU", "Al-Wildan Press"],
    titleKeywords: ["QC IBADAH", "WEEKLY PROGRESS REPORT", "WPR", "BUKU MUTABAAH"],
  },
  {
    id: "sup-global-fotocopy",
    code: "SUP-GLOBAL",
    name: "Global Foto Copy & Percetakan",
    contactPerson: "Ustadz Idi Darma",
    phone: "0813 7086 1684",
    address: "Percetakan Buku Modul Cepat & Workbook Tambahan",
    type: "book",
    publisherKeywords: ["CETAK IDI DARMA"],
  },
  {
    id: "sup-tb-farhan",
    code: "SUP-FARHAN",
    name: "Toko Buku Farhan",
    contactPerson: "Ustadz Surahman",
    phone: "0812-7788-9900",
    address: "Penyedia Buku Kitab Diniyyah Impor & Lokal (Diskon 35%)",
    type: "book",
    publisherKeywords: ["TOKO/PERCETAKAN KHUSUS", "FARHAN"],
  },
  {
    id: "sup-dakwah-taklim",
    code: "SUP-DAKWAH",
    name: "Lembaga Dakwah dan Taklim",
    contactPerson: "Abdurrahman",
    phone: "0812 8743 633",
    address: "Penyalur Buku Risalah & Panduan Ibadah",
    type: "book",
    publisherKeywords: ["DICKENS PUBLISHING", "VECTOR"],
  },
];

export async function seedMasterSuppliers(targetDb: AppDatabase) {
  const now = new Date().toISOString();

  // 1. Masukkan Master Supplier secara Idempoten
  for (const s of OFFICIAL_SUPPLIERS) {
    await targetDb
      .insert(suppliers)
      .values({
        id: s.id,
        code: s.code,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        address: s.address,
        type: s.type,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  // 2. Hubungkan Buku ke Supplier di book_suppliers
  const allBooks = await targetDb
    .select({
      id: books.id,
      title: books.title,
      publisher: books.publisher,
    })
    .from(books);

  const newLinks: Array<{ bookId: string; supplierId: string; createdAt: string }> = [];

  for (const b of allBooks) {
    const pub = (b.publisher || "").toLowerCase();
    const title = (b.title || "").toUpperCase();

    let matchedSupplierId: string | null = null;

    if (pub.includes("scholastic") || title.includes("PRIME MATH")) {
      matchedSupplierId = "sup-cnl";
    } else if (pub.includes("pelangi") || title.includes("I LEAP") || title.includes("YOK!HOP") || title.includes("MY PRESCHOOL")) {
      matchedSupplierId = "sup-pelangi";
    } else if (title.includes("PHYSICS") || title.includes("CHEMISTRY") || title.includes("BIOLOGY")) {
      matchedSupplierId = "sup-mentari";
    } else if (pub.includes("erlangga") || title.includes("MATEMATIKA") || title.includes("PENDIDIKAN PANCASILA") || title.includes("BAHASA INDONESIA") || title.includes("PJOK") || title.includes("SENI")) {
      matchedSupplierId = "sup-erlangga";
    } else if (pub.includes("darsyafi") || title.includes("AKIDAH") || title.includes("FIKIH") || title.includes("HADIST") || title.includes("TAJWID") || title.includes("SKI")) {
      matchedSupplierId = "sup-darsyafii";
    } else if (title.includes("ARAB") || title.includes("LUGHAH")) {
      matchedSupplierId = "sup-segara-makmur";
    } else if (title.includes("QUR'AN") || title.includes("QURAN") || title.includes("NURRONIYAH")) {
      matchedSupplierId = "sup-manzilla";
    } else if (title.includes("WPR") || title.includes("PROGRESS REPORT") || title.includes("MUTABAAH") || title.includes("QC IBADAH")) {
      matchedSupplierId = "sup-mega-wira";
    } else if (pub.includes("cambridge")) {
      matchedSupplierId = "sup-cnl";
    } else {
      matchedSupplierId = "sup-darsyafii"; // fallback default buku al-wildan
    }

    if (matchedSupplierId) {
      newLinks.push({
        bookId: b.id,
        supplierId: matchedSupplierId,
        createdAt: now,
      });
    }
  }

  for (const chunk of chunkRows(newLinks)) {
    await targetDb.insert(bookSuppliers).values(chunk).onConflictDoNothing();
  }

  const currentSuppliers = await targetDb.select().from(suppliers);
  const currentLinks = await targetDb.select().from(bookSuppliers);

  return {
    suppliersCount: currentSuppliers.length,
    linksCount: currentLinks.length,
  };
}
