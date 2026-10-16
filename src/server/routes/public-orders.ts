import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, or, like, and, notInArray, sql, ne } from "drizzle-orm";
import { db } from "../../db";
import { students, studentBookOrders, bookPackages, schools } from "../../db/schema";
import { listPackagesWithBom, PACKAGE_LIST_LIMIT } from "../services/package-stock";
import { reportReturn } from "../services/return";
import {
  getCurrentSatuanStatus,
  getSatuanCatalogIfOpen,
  getSatuanStatus,
  submitPublicOrder,
  validateStudentForOrder,
} from "../services/order-intake";
import { RealWhatsAppSender, type SendWhatsAppResult } from "../services/whatsapp";
import { countPackageOrders } from "../services/wpr";
import { confirmBookPayment, lookupBookByToken } from "../services/order-invoice";
import { WPR_PRICE, needsWprCharge } from "../../lib/wpr";
import { formatRupiah } from "../../lib/transfer-pricing";
import { idSchema } from "../lib/validators";

export const publicOrdersRouter = new Hono();

// Schema for student search
const searchStudentSchema = z.object({
  query: z.string().min(2, "Minimal 2 karakter untuk pencarian"),
  schoolId: z.string().min(1, "Pilih sekolah terlebih dahulu"),
});

// Schema for new student registration (when student not found)
const createNewStudentSchema = z.object({
  schoolId: z.string().min(1, "Sekolah wajib dipilih"),
  name: z.string().min(1, "Nama murid wajib diisi"),
  gender: z.enum(["male", "female"]).default("male"),
  gradeLevel: z.string().min(1, "Kelas wajib dipilih"),
  curriculumType: z.enum(["international", "national"]).default("international"),
  academicYear: z.string().min(1, "Tahun ajaran wajib diisi"),
  parentName: z.string().min(1, "Nama orang tua wajib diisi"),
  parentEmail: z.string().email("Format email orang tua tidak valid"),
  parentPhone: z.string().min(6, "Nomor telepon/WA wajib diisi"),
});

// Schema for book order submission
const looseOrderItemSchema = z.object({
  bookId: z.string().min(1, "Judul buku wajib dipilih"),
  quantity: z.number().int().min(1, "Jumlah minimal 1").max(50),
});

const submitOrderSchema = z
  .object({
    studentId: z.string().min(1, "Student ID wajib diisi"),
    packageId: idSchema.optional(),
    looseItems: z.array(looseOrderItemSchema).default([]),
    homeAddress: z.string().optional(),
    orderType: z.enum(["regular", "scholarship"]).default("regular"),
    scholarshipProofBase64: z.string().optional(), // For scholarship 100% discount
    // Optional payment info submitted immediately
    payment: z
      .object({
        transferAmount: z.number().int().min(0),
        bookAllocationAmount: z.number().int().min(0),
        bankName: z.string().optional(),
        referenceNumber: z.string().optional(),
        paymentProofBase64: z.string().optional(),
      })
      .optional(),
    notes: z.string().optional(),
  })
  .refine((v) => !!v.packageId || v.looseItems.length > 0, {
    message: "Pilih paket atau minimal satu judul buku satuan",
  });

// 0. Status order satuan (public, tanpa login) + katalog satuan saat terbuka
publicOrdersRouter.get("/satuan-status", async (c) => {
  const academicYear = c.req.query("academicYear")?.trim();
  const status = academicYear
    ? await getSatuanStatus(db, academicYear)
    : await getCurrentSatuanStatus(db);
  return c.json({ success: true, data: status });
});

publicOrdersRouter.get("/satuan-catalog", async (c) => {
  const academicYear = c.req.query("academicYear")?.trim();
  const catalog = await getSatuanCatalogIfOpen(db, academicYear || undefined);
  return c.json({ success: true, data: catalog });
});

// 0b. Katalog publik paket + sekolah (tanpa login): harga + BOM wajib terlihat.
// Anti window-shopping: judul memakai alias samaran (fallback generik, bukan
// judul real), tanpa ISBN/penulis/penerbit/cover agar tak bisa dicari di
// online shop. Endpoint staf /api/packages tetap terkunci.
publicOrdersRouter.get("/packages", async (c) => {
  const pkgs = await listPackagesWithBom(db, PACKAGE_LIST_LIMIT);
  return c.json({
    success: true,
    data: pkgs.map((p) => ({
      ...p,
      items: p.items.map((it) => ({
        id: it.id,
        bookId: it.bookId,
        title: it.publicTitle ?? "Buku Paket",
        quantity: it.quantity,
      })),
    })),
  });
});

// 0c. Pilihan judul untuk retur publik: alias samaran saja, tanpa ISBN.
publicOrdersRouter.get("/book-choices", async (c) => {
  const pkgs = await listPackagesWithBom(db, PACKAGE_LIST_LIMIT);
  const seen = new Map<string, string>();
  for (const p of pkgs) {
    for (const it of p.items) {
      if (!seen.has(it.bookId)) seen.set(it.bookId, it.publicTitle ?? "Buku Paket");
    }
  }
  return c.json({
    success: true,
    data: [...seen].map(([bookId, title]) => ({ bookId, title })),
  });
});

publicOrdersRouter.get("/schools", async (c) => {
  const rows = await db
    .select({ id: schools.id, name: schools.name, code: schools.code })
    .from(schools)
    .where(ne(schools.type, "warehouse"));
  return c.json({ success: true, data: rows });
});

// 0d. Kelayakan WPR satuan: hijau bila murid sudah punya order paket (reguler/beasiswa).
publicOrdersRouter.get("/wpr-eligibility", async (c) => {
  const studentId = c.req.query("studentId")?.trim();
  if (!studentId) return c.json({ success: false, message: "studentId wajib diisi" }, 400);
  const [student] = await db.select({ id: students.id }).from(students).where(eq(students.id, studentId));
  if (!student) return c.json({ success: false, message: "Murid tidak ditemukan" }, 404);
  const packageCount = await countPackageOrders(db, studentId);
  const needsWpr = needsWprCharge(packageCount);
  return c.json({ success: true, data: { needsWpr, wprPrice: needsWpr ? WPR_PRICE : 0 } });
});

// 1. Search student by partial NIS or Name (Auto-detection of promotion)
publicOrdersRouter.get("/search-students", zValidator("query", searchStudentSchema), async (c) => {
  const { query, schoolId } = c.req.valid("query");
  const cleanQ = `%${query.trim().toLowerCase()}%`;

  // Portal hanya boleh menemukan siswa terverifikasi: sembunyikan
  // new_pending (menunggu admin) dan rejected (ditolak admin).
  const verifiedOnly = notInArray(students.status, ["new_pending", "rejected"]);
  const matchFilter = or(
    like(sql`lower(${students.name})`, cleanQ),
    like(sql`lower(${students.nis})`, cleanQ)
  );

  const whereCondition = and(eq(students.schoolId, schoolId), matchFilter, verifiedOnly);

  const foundStudents = await db
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      gradeLevel: students.gradeLevel,
      curriculumType: students.curriculumType,
      academicYear: students.academicYear,
      status: students.status,
      isScholarship: students.isScholarship,
      schoolId: students.schoolId,
      schoolName: schools.name,
      parentName: students.parentName,
      parentEmail: students.parentEmail,
      parentPhone: students.parentPhone,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(whereCondition)
    .limit(10);

  // Analyze potential promotion (naik kelas)
  // Kelayakan order diiklankan server dari seam validasi yang sama dengan
  // submit (satu sumber aturan): hook portal me-render verbatim, bukan
  // menebak status mana yang boleh memesan.
  const results = foundStudents.map((st: any) => {
    const currentGrade = parseInt(st.gradeLevel, 10);
    const nextGrade = !isNaN(currentGrade) ? (currentGrade + 1).toString() : st.gradeLevel;
    const isPromoted = st.status === "promoted";
    const eligibility = validateStudentForOrder(st);

    return {
      ...st,
      detectedStatus: isPromoted ? "naik_kelas" : st.status === "active" ? "aktif" : "baru",
      currentGradeLevel: st.gradeLevel,
      targetGradeLevel: isPromoted ? nextGrade : st.gradeLevel,
      canOrder: eligibility.ok,
      orderBlockedReason: eligibility.ok ? null : eligibility.message,
    };
  });

  return c.json({ success: true, data: results });
});

// 2. Register New Student via Public Form (Status: new_pending)
publicOrdersRouter.post("/register-student", zValidator("json", createNewStudentSchema), async (c) => {
  const body = c.req.valid("json");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const tempNis = `REG-${Date.now().toString().slice(-6)}`;

  await db.insert(students).values({
    id,
    schoolId: body.schoolId,
    nis: tempNis,
    name: body.name,
    gender: body.gender,
    gradeLevel: body.gradeLevel,
    curriculumType: body.curriculumType,
    academicYear: body.academicYear,
    parentName: body.parentName,
    parentEmail: body.parentEmail,
    parentPhone: body.parentPhone,
    status: "new_pending",
    isScholarship: false,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(students).where(eq(students.id, id));
  return c.json({ success: true, message: "Pendaftaran siswa baru berhasil disimpan", data: created }, 201);
});

// 3. Submit Order (Regular or Scholarship 100%)
publicOrdersRouter.post("/submit", zValidator("json", submitOrderSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await submitPublicOrder(body, { database: db });

  if (!result.ok) {
    return c.json({ success: false, message: result.message }, result.status);
  }

  // Notifikasi WhatsApp ke orang tua: ditunggu hasilnya dan dilaporkan ke
  // pemanggil (bukan fire-and-forget). Kegagalan notifikasi TIDAK menggagalkan
  // pesanan yang sudah terbentuk — hanya tercatat di respons.
  const [st] = await db.select().from(students).where(eq(students.id, body.studentId));
  let notification: SendWhatsAppResult | null = null;
  if (st?.parentPhone) {
    const waText = `Halo Bapak/Ibu ${st.parentName || "Wali Murid"},\n\nPesanan buku untuk ananda ${st.name} telah berhasil dibuat dengan No. Order: ${result.data.order.orderNumber}.\nTotal: ${formatRupiah(result.data.totalAmount)}\nStatus Pembayaran: ${result.data.paymentStatus === "paid" ? "Lunas" : "Menunggu / Parsial"}\n\nTerima kasih,\nAl Wildan Logistics`;
    try {
      notification = await new RealWhatsAppSender(db).send({ to: st.parentPhone, text: waText });
    } catch (e: unknown) {
      notification = { success: false, error: e instanceof Error ? e.message : "Gagal mengirim notifikasi WhatsApp" };
    }
  }

  return c.json({
    success: true,
    message: "Pesanan buku berhasil dibuat!",
    data: { ...result.data, notification },
  }, 201);
});

// 6. Konfirmasi pembayaran via link invoice (lunas/bertahap, termin bebas)
publicOrdersRouter.get("/confirm/:token", async (c) => {
  const found = await lookupBookByToken(db, c.req.param("token"));
  if (!found) return c.json({ success: false, message: "Link konfirmasi tidak valid." }, 404);
  return c.json({
    success: true,
    data: {
      studentName: found.student?.name ?? null,
      orderNumber: found.order.orderNumber,
      totalAmount: found.order.totalAmount,
      shippingCost: found.order.shippingCost ?? 0,
      due: found.due,
      paidAmount: found.order.paidAmount,
      paymentStatus: found.order.paymentStatus,
      invoiceSentAt: found.order.invoiceSentAt,
    },
  });
});

const confirmPaymentSchema = z.object({
  transferAmount: z.number().int().min(1, "Nominal transfer minimal Rp 1"),
  allocationAmount: z.number().int().min(1, "Nominal alokasi minimal Rp 1"),
  bankName: z.string().optional(),
  referenceNumber: z.string().optional(),
  paymentProofBase64: z.string().optional(),
});

publicOrdersRouter.post("/confirm/:token", zValidator("json", confirmPaymentSchema), async (c) => {
  const result = await confirmBookPayment(db, c.req.param("token"), c.req.valid("json"));
  if (!result.ok) return c.json({ success: false, message: result.message }, result.status);
  return c.json({ success: true, message: "Konfirmasi pembayaran tercatat.", data: result.data }, 201);
});

// 4. Public Lookup Order for Defect Return (by Order Number or Student NIS)
// Pencarian partisi (ADR-0002): wajib didahului school_id terindeks + LIMIT,
// cerminan search-students. Pencarian global tanpa sekolah dilarang (Pindai Penuh).
// Ubah bentuk WHERE di bawah? Sinkronkan juga query "lookup-order partitioned join"
// di scripts/explain-plan.ts agar gate check:plans tetap mengunci buktinya.
publicOrdersRouter.get("/lookup-order", async (c) => {
  const query = c.req.query("query")?.trim();
  if (!query || query.length < 3) {
    return c.json({ success: false, message: "Masukkan minimal 3 karakter No. Pesanan atau NIS" }, 400);
  }
  const lookupSchoolId = c.req.query("schoolId")?.trim();
  if (!lookupSchoolId) {
    return c.json({ success: false, message: "Pilih sekolah terlebih dahulu untuk mencari pesanan" }, 400);
  }

  // Find order by orderNumber or student NIS within the school partition
  const lookupMatch = or(
    like(studentBookOrders.orderNumber, `%${query}%`),
    like(students.nis, `%${query}%`),
    like(students.name, `%${query}%`)
  );
  const matchedOrders = await db
    .select({
      id: studentBookOrders.id,
      orderNumber: studentBookOrders.orderNumber,
      studentId: studentBookOrders.studentId,
      studentName: students.name,
      nis: students.nis,
      schoolId: studentBookOrders.schoolId,
      schoolName: schools.name,
      packageId: studentBookOrders.packageId,
      packageName: bookPackages.name,
      fulfillmentStatus: studentBookOrders.fulfillmentStatus,
      paymentStatus: studentBookOrders.paymentStatus,
      handoverDate: studentBookOrders.handoverDate,
      handoverDeliveryNumber: studentBookOrders.handoverDeliveryNumber,
      handoverRecipient: studentBookOrders.handoverRecipient,
    })
    .from(studentBookOrders)
    .innerJoin(students, eq(studentBookOrders.studentId, students.id))
    .innerJoin(schools, eq(studentBookOrders.schoolId, schools.id))
    .leftJoin(bookPackages, eq(studentBookOrders.packageId, bookPackages.id))
    .where(and(eq(studentBookOrders.schoolId, lookupSchoolId), lookupMatch))
    .limit(10);

  if (matchedOrders.length === 0) {
    return c.json({ success: false, message: "Pesanan buku tidak ditemukan dengan kata kunci tersebut" }, 404);
  }

  return c.json({ success: true, data: matchedOrders });
});

// 5. Public Submit Return (for parents/students reporting defect)
const publicReturnSchema = z.object({
  orderId: z.string().min(1, "ID pesanan wajib diisi"),
  studentId: z.string().min(1, "ID murid wajib diisi"),
  defectiveBookId: z.string().min(1, "Buku yang rusak wajib dipilih"),
  reason: z.string().min(5, "Alasan / deskripsi kerusakan minimal 5 karakter"),
  photoProofBase64: z.string().min(1, "Foto bukti fisik buku rusak wajib dilampirkan"),
});

publicOrdersRouter.post("/submit-return", zValidator("json", publicReturnSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await reportReturn(db, { ...body, source: "public" });
  if (!result.ok) {
    return c.json({ success: false, message: result.message }, result.status);
  }

  return c.json({
    success: true,
    message: "Laporan retur buku rusak berhasil dikirimkan. Tim logistik sekolah akan segera memproses penggantian fisik buku Anda.",
    data: {
      returnId: result.created.id,
      orderNumber: result.orderNumber,
      status: "reported",
    },
  }, 201);
});
