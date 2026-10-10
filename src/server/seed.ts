import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { 
  schools, 
  books, 
  bookItems, 
  students, 
  suppliers, 
  purchaseOrders, 
  purchaseOrderItems, 
  bookPackages, 
  bookPackageItems, 
  packageItems, 
  studentBookOrders, 
  orderPayments, 
  bookReturns, 
  systemSettings,
  users,
  accounts
} from "../db/schema";

export async function runIdempotentSeed(customDb?: any) {
  const targetDb = customDb || db;
  const now = new Date().toISOString();

  // 1. Check if schools already exist
  await targetDb.select().from(schools);

  // 1. Schools (4 Al Wildan Campuses)
  const schoolData = [
    {
      id: "school-alw-1",
      name: "Al Wildan 1 (Islamic School Pusat)",
      code: "ALW-01-HQ",
      type: "main" as const,
      address: "Jl. Boulevard Al Wildan No. 1, Tangerang Selatan",
      phone: "+62 21 5550101",
    },
    {
      id: "school-alw-2",
      name: "Al Wildan 2 (Islamic School)",
      code: "ALW-02",
      type: "branch" as const,
      address: "Jl. Pendidikan Barat No. 12, Bekasi",
      phone: "+62 21 5550102",
    },
    {
      id: "school-alw-3",
      name: "Al Wildan 3 (Islamic School)",
      code: "ALW-03",
      type: "branch" as const,
      address: "Jl. KH. Hasyim Asyari No. 88, Tangerang",
      phone: "+62 21 5550103",
    },
    {
      id: "school-alw-4",
      name: "Al Wildan 4 (Islamic School)",
      code: "ALW-04",
      type: "branch" as const,
      address: "Jl. Raya Ciater No. 45, BSD City",
      phone: "+62 21 5550104",
    },
    {
      id: "school-warehouse",
      name: "Gudang Logistik Al Wildan",
      code: "GUDANG-LOG",
      type: "warehouse" as const,
      address: "Jl. Gudang Logistik No. 1, Tangerang Selatan",
      phone: "+62 21 5550100",
    },
  ];

  for (const s of schoolData) {
    await targetDb
      .insert(schools)
      .values({ ...s, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: schools.id,
        set: { name: s.name, code: s.code, type: s.type, address: s.address, phone: s.phone, updatedAt: now },
      });
  }

  // 2. Demo Users (Ensure user and account tables have demo credentials)
  const demoUsers = [
    {
      id: "usr-admin-pusat",
      name: "School Admin Al Wildan 1",
      email: "admin.pusat@alwildan.sch.id",
      role: "school_admin" as const,
      schoolId: "school-alw-1",
    },
    {
      id: "usr-admin-cabang2",
      name: "Branch Admin Al Wildan 2",
      email: "admin.cabang2@alwildan.sch.id",
      role: "branch_admin" as const,
      schoolId: "school-alw-2",
    },
    {
      id: "usr-admin-cabang3",
      name: "Branch Admin Al Wildan 3",
      email: "admin.cabang3@alwildan.sch.id",
      role: "branch_admin" as const,
      schoolId: "school-alw-3",
    },
    {
      id: "usr-admin-cabang4",
      name: "Branch Admin Al Wildan 4",
      email: "admin.cabang4@alwildan.sch.id",
      role: "branch_admin" as const,
      schoolId: "school-alw-4",
    },
    {
      id: "usr-admin-gudang",
      name: "Super Admin Gudang Logistik",
      email: "admin.gudang@alwildan.sch.id",
      role: "central_admin" as const,
      schoolId: "school-warehouse",
    },
  ];

  for (const u of demoUsers) {
    try {
      await targetDb.insert(users).values({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        schoolId: u.schoolId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();

      // Password hash for 'password123' used by Better-Auth scrypt/argon2 or fallback
      // For Better-Auth credential accounts:
      await targetDb.insert(accounts).values({
        id: `acc-${u.id}`,
        userId: u.id,
        accountId: u.email,
        providerId: "credential",
        password: "cGFzc3dvcmQxMjM6Y2U2ZDIxYTNhOGQ2NDJkOTljMjJjNjIxMzNjMGFjMmI=", // salt & hash stub
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    } catch {
      // Ignored if user already exists
    }
  }

  // 3. Master Books (upsert idempotent, lihat blok di bawah)
  const bookList = [
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

  // Upsert idempotent agar buku demo baru (mis. Kelas 2) masuk ke DB lama juga.
  // Harga hanya di-backfill untuk buku yang masih 0 agar edit manual tidak tertimpa rerun.
  // `buyPrice`/`sellPrice` diisi terpisah dari `price` (model harga fase 2); bila `price`
  // sudah terisi tetapi harga baru masih 0, keduanya diturunkan dari harga lama.
  for (const b of bookList) {
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

  // 4. Packages (upsert idempotent agar paket demo baru masuk ke DB lama juga)
  // Harga paket diturunkan dari jumlah harga jual komponen (bukan input manual).
  const bomByPackage: Record<string, string[]> = {
    "pkg-sd1-int": ["b-math-1", "b-sci-1", "b-eng-1", "b-pai-1", "b-bindo-1", "b-ppkn-1", "b-arab-1", "b-tahfidz-1"],
    "pkg-sd1-nas": ["b-pai-1", "b-bindo-1", "b-ppkn-1", "b-tahfidz-1"],
    "pkg-sd2-int": ["b-math-2", "b-sci-2", "b-eng-2", "b-pai-2", "b-bindo-1", "b-ppkn-1", "b-arab-1", "b-tahfidz-1"],
    "pkg-sd2-nas": ["b-pai-2", "b-bindo-1", "b-ppkn-1", "b-tahfidz-1"],
  };
  const sellByBookId = new Map(bookList.map((b) => [b.id, b.sellPrice]));
  const bomIdPrefix: Record<string, string> = {
    "pkg-sd1-int": "bom-sd1int",
    "pkg-sd1-nas": "bom-sd1nas",
    "pkg-sd2-int": "bom-sd2int",
    "pkg-sd2-nas": "bom-sd2nas",
  };
  const computePackagePrice = (packageId: string) =>
    (bomByPackage[packageId] ?? []).reduce((sum, bookId) => sum + (sellByBookId.get(bookId) ?? 0), 0);

  const packageData = [
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

  for (const p of packageData) {
    await targetDb
      .insert(bookPackages)
      .values({ ...p, price: computePackagePrice(p.id), createdAt: now, updatedAt: now })
      .onConflictDoNothing();
    // Samakan harga paket yang sudah ada agar tetap mengikuti komponen terkini.
    await targetDb
      .update(bookPackages)
      .set({ price: computePackagePrice(p.id), updatedAt: now })
      .where(eq(bookPackages.id, p.id));
  }

  {
    // BOM Components per paket (sumber kebenaran harga paket).
    // Prefix id dipertahankan sama dengan seed lama agar upsert tetap idempotent.
    for (const [packageId, bookIds] of Object.entries(bomByPackage)) {
      const prefix = bomIdPrefix[packageId];
      for (const bId of bookIds) {
        await targetDb.insert(bookPackageItems).values({
          id: `${prefix}-${bId}`,
          packageId,
          bookId: bId,
          quantity: 1,
          createdAt: now,
        }).onConflictDoNothing();
      }
    }
  }

  // 5. Seed Loose Items in school-alw-1 (Stok Satuan)
  const existingItems = await targetDb.select().from(bookItems);
  if (existingItems.length === 0) {
    for (const b of bookList) {
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
  }

  // 6. Pre-Assembled Package Items (Stok Bundle Jadi)
  const existingBundles = await targetDb.select().from(packageItems);
  if (existingBundles.length === 0) {
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

  // 7. Students (upsert idempotent agar siswa demo baru masuk ke DB lama juga)
  {
    const studentData = [
      {
        id: "std-hendra-1",
        schoolId: "school-alw-1",
        nis: "2024101001",
        name: "Hendra Wahyudi",
        gender: "male" as const,
        gradeLevel: "1",
        curriculumType: "international" as const,
        academicYear: "2025/2026",
        parentName: "Drs. Wahyudi Pratama",
        parentEmail: "wahyudi.pratama@gmail.com",
        parentPhone: "+6281234567890",
        status: "promoted" as const, // Naik ke kelas 2
        isScholarship: false,
      },
      {
        id: "std-aisyah-2",
        schoolId: "school-alw-1",
        nis: "2024101002",
        name: "Aisyah Nur Salsabila",
        gender: "female" as const,
        gradeLevel: "1",
        curriculumType: "international" as const,
        academicYear: "2026/2027",
        parentName: "Ir. Bambang Trihatmojo",
        parentEmail: "bambang.tri@gmail.com",
        parentPhone: "+6281298765432",
        status: "active" as const,
        isScholarship: false,
      },
      {
        id: "std-farhan-3",
        schoolId: "school-alw-1",
        nis: "2024101003",
        name: "Muhammad Farhan Al-Ghifari",
        gender: "male" as const,
        gradeLevel: "1",
        curriculumType: "international" as const,
        academicYear: "2026/2027",
        parentName: "Ustadz Ghifari",
        parentEmail: "ghifari.al@gmail.com",
        parentPhone: "+6281311223344",
        status: "active" as const,
        isScholarship: true, // Beasiswa 100%
      },
      {
        id: "std-nathan-4",
        schoolId: "school-alw-1",
        nis: "2024101004",
        name: "Nathaniel Arya",
        gender: "male" as const,
        gradeLevel: "1",
        curriculumType: "national" as const,
        academicYear: "2026/2027",
        parentName: "Dewi Sartika",
        parentEmail: "dewi.sartika@gmail.com",
        parentPhone: "+6281555667788",
        status: "active" as const,
        isScholarship: false,
      },
      {
        id: "std-kayla-5",
        schoolId: "school-alw-1",
        nis: "2024101005",
        name: "Kayla Putri Ramadhani",
        gender: "female" as const,
        gradeLevel: "2",
        curriculumType: "international" as const,
        academicYear: "2026/2027",
        parentName: "Hj. Ramadhani",
        parentEmail: "ramadhani.ibu@gmail.com",
        parentPhone: "+6281777888999",
        status: "active" as const, // Tetap Kelas 2 Internasional
        isScholarship: false,
      },
      {
        id: "std-bimo-6",
        schoolId: "school-alw-1",
        nis: "2024101006",
        name: "Bimo Aditya Saputra",
        gender: "male" as const,
        gradeLevel: "1",
        curriculumType: "national" as const,
        academicYear: "2025/2026",
        parentName: "Aditya Saputra",
        parentEmail: "aditya.saputra@gmail.com",
        parentPhone: "+6281888999000",
        status: "promoted" as const, // Naik ke Kelas 2 Nasional
        isScholarship: false,
      },
      {
        id: "std-salsa-7",
        schoolId: "school-alw-1",
        nis: "2024101007",
        name: "Salsabila Zahra",
        gender: "female" as const,
        gradeLevel: "2",
        curriculumType: "national" as const,
        academicYear: "2026/2027",
        parentName: "Fatimah Zahra",
        parentEmail: "fatimah.zahra@gmail.com",
        parentPhone: "+6281999000111",
        status: "active" as const, // Tetap Kelas 2 Nasional
        isScholarship: false,
      },
      {
        id: "std-raka-8",
        schoolId: "school-alw-1",
        nis: "2024101008",
        name: "Raka Pradipta",
        gender: "male" as const,
        gradeLevel: "2",
        curriculumType: "international" as const,
        academicYear: "2025/2026",
        parentName: "Pradipta Wijaya",
        parentEmail: "pradipta.w@gmail.com",
        parentPhone: "+6281000111222",
        status: "promoted" as const, // Naik ke Kelas 3 (paket belum ada -> empty state)
        isScholarship: false,
      },
    ];

    for (const st of studentData) {
      await targetDb
        .insert(students)
        .values({ ...st, createdAt: now, updatedAt: now })
        .onConflictDoNothing();
    }
  }

  // 8. Orders & Scenarios
  const existingOrders = await targetDb.select().from(studentBookOrders);
  if (existingOrders.length === 0) {
    // Skenario 1: Aisyah (Lunas & Sudah Ambil dengan Surat Jalan)
    await targetDb.insert(studentBookOrders).values({
      id: "ord-aisyah-done",
      orderNumber: "ORD-202609-001",
      studentId: "std-aisyah-2",
      schoolId: "school-alw-1",
      packageId: "pkg-sd1-int",
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      totalAmount: 1850000,
      paidAmount: 1850000,
      handoverDeliveryNumber: "SJ-SERAH-202609-0012",
      handoverDate: now,
      handoverRecipient: "Ir. Bambang Trihatmojo (Ayah)",
      notes: "Lunas transfer BCA, diserahkan di loket logistik sekolah",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await targetDb.insert(orderPayments).values({
      id: "pay-aisyah-1",
      orderId: "ord-aisyah-done",
      transferAmount: 1850000,
      bookAllocationAmount: 1850000,
      bankName: "BCA",
      referenceNumber: "BCA-TRX-881920",
      notes: "Pembayaran lunas buku",
      createdAt: now,
    }).onConflictDoNothing();

    // Skenario 2: Nathaniel (Cicilan / Partial Payment)
    await targetDb.insert(studentBookOrders).values({
      id: "ord-nathan-partial",
      orderNumber: "ORD-202609-002",
      studentId: "std-nathan-4",
      schoolId: "school-alw-1",
      packageId: "pkg-sd1-nas",
      orderType: "regular",
      paymentStatus: "partial",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: 950000,
      paidAmount: 500000,
      notes: "Ortu transfer gabungan SPP Rp 2.500.000 + Buku Rp 500.000 (Sisa Rp 450.000)",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await targetDb.insert(orderPayments).values({
      id: "pay-nathan-1",
      orderId: "ord-nathan-partial",
      transferAmount: 3000000,
      bookAllocationAmount: 500000,
      bankName: "Mandiri",
      referenceNumber: "MND-TRX-551299",
      notes: "Transfer gabungan SPP bulan Juli dan cicilan ke-1 buku paket",
      createdAt: now,
    }).onConflictDoNothing();

    // Skenario 3: Farhan (Beasiswa 100%)
    await targetDb.insert(studentBookOrders).values({
      id: "ord-farhan-sch",
      orderNumber: "ORD-202609-003",
      studentId: "std-farhan-3",
      schoolId: "school-alw-1",
      packageId: "pkg-sd1-int",
      orderType: "scholarship",
      paymentStatus: "scholarship_pending",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: 0,
      paidAmount: 0,
      scholarshipProofUrl: "/api/media/scholarships/demo-surat-beasiswa.jpg",
      notes: "Melampirkan surat rekomendasi beasiswa tahfidz Al-Qur'an 30 Juz",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // Skenario 4: Hendra Wahyudi (Naik Kelas 2 - Unpaid)
    await targetDb.insert(studentBookOrders).values({
      id: "ord-hendra-unpaid",
      orderNumber: "ORD-202609-004",
      studentId: "std-hendra-1",
      schoolId: "school-alw-1",
      packageId: "pkg-sd2-int",
      orderType: "regular",
      paymentStatus: "unpaid",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: 1950000,
      paidAmount: 0,
      notes: "Siswa naik kelas, menunggu konfirmasi pembayaran orang tua",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // Skenario 5: Retur Buku Cacat
    await targetDb.insert(bookReturns).values({
      id: "ret-demo-1",
      orderId: "ord-aisyah-done",
      studentId: "std-aisyah-2",
      defectiveBookId: "b-math-1",
      reason: "Halaman 20 sampai 35 robek dan cetakan matematika buram tidak terbaca",
      photoProofUrl: "/api/media/returns/demo-buku-rusak.jpg",
      status: "reported",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }

  // 9. Suppliers & PO
  const existingSuppliers = await targetDb.select().from(suppliers);
  if (existingSuppliers.length === 0) {
    await targetDb.insert(suppliers).values([
      {
        id: "sup-erlangga",
        code: "SUP-ERL",
        name: "PT Penerbit Erlangga Mahameru",
        contactPerson: "Drs. Hendro Wibowo",
        email: "order@erlangga.co.id",
        phone: "+62 21 8717888",
        address: "Jl. H. Baping Raya No. 100, Ciracas, Jakarta Timur",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sup-cambridge-mentari",
        code: "SUP-MEN",
        name: "PT Mentari Books Utama (Cambridge Official Distributor)",
        contactPerson: "Lina Marlina, M.Ed",
        email: "cambridge@mentaribooks.com",
        phone: "+62 21 5890888",
        address: "Rukan Puri Mutiara Blok A No. 15, Kembangan, Jakarta Barat",
        createdAt: now,
        updatedAt: now,
      },
    ]).onConflictDoNothing();

    await targetDb.insert(purchaseOrders).values({
      id: "po-demo-001",
      poNumber: "PO-202609-0088",
      supplierId: "sup-cambridge-mentari",
      targetSchoolId: "school-warehouse",
      status: "partially_received",
      orderDate: "2026-09-20",
      expectedArrivalDate: "2026-09-28",
      totalAmount: 18500000,
      notes: "Pengadaan awal buku Cambridge Mathematics & Science Semester 1",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await targetDb.insert(purchaseOrderItems).values([
      {
        id: "poi-demo-1",
        purchaseOrderId: "po-demo-001",
        bookId: "b-math-1",
        quantityOrdered: 100,
        quantityReceived: 40,
        unitPrice: 95000,
        createdAt: now,
      },
      {
        id: "poi-demo-2",
        purchaseOrderId: "po-demo-001",
        bookId: "b-sci-1",
        quantityOrdered: 100,
        quantityReceived: 40,
        unitPrice: 90000,
        createdAt: now,
      },
    ]).onConflictDoNothing();
  }

  // 10. SMTP Settings
  await targetDb.insert(systemSettings).values({
    key: "smtp_host",
    value: "smtp.gmail.com",
    description: "Default SMTP Host",
    updatedAt: now,
  }).onConflictDoNothing();

  return {
    success: true,
    data: {
      schoolsSeeded: schoolData.length,
      usersSeeded: demoUsers.length,
      booksSeeded: bookList.length,
      packagesSeeded: packageData.length,
      studentsSeeded: 8,
    },
  };
}
