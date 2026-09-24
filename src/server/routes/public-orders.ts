import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, or, like, and } from "drizzle-orm";
import { db } from "../../db";
import { students, studentBookOrders, orderPayments, bookPackages, schools } from "../../db/schema";
import { defaultStorage } from "../../services/storage";

export const publicOrdersRouter = new Hono();

// Schema for student search
const searchStudentSchema = z.object({
  query: z.string().min(2, "Minimal 2 karakter untuk pencarian"),
  schoolId: z.string().optional(),
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
const submitOrderSchema = z.object({
  studentId: z.string().min(1, "Student ID wajib diisi"),
  packageId: z.string().min(1, "Paket buku wajib dipilih"),
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
});

// 1. Search student by partial NIS or Name (Auto-detection of promotion)
publicOrdersRouter.get("/search-students", zValidator("query", searchStudentSchema), async (c) => {
  const { query, schoolId } = c.req.valid("query");
  const cleanQ = `%${query.trim()}%`;

  const whereCondition = schoolId
    ? and(
        eq(students.schoolId, schoolId),
        or(like(students.name, cleanQ), like(students.nis, cleanQ))
      )
    : or(like(students.name, cleanQ), like(students.nis, cleanQ));

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
  const results = foundStudents.map((st: any) => {
    const currentGrade = parseInt(st.gradeLevel, 10);
    const nextGrade = !isNaN(currentGrade) ? (currentGrade + 1).toString() : st.gradeLevel;
    const isPromoted = st.status === "promoted";

    return {
      ...st,
      detectedStatus: isPromoted ? "naik_kelas" : st.status === "active" ? "aktif" : "baru",
      currentGradeLevel: st.gradeLevel,
      targetGradeLevel: isPromoted ? nextGrade : st.gradeLevel,
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
  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

  // Find student
  const [student] = await db.select().from(students).where(eq(students.id, body.studentId));
  if (!student) {
    return c.json({ success: false, message: "Data murid tidak ditemukan" }, 404);
  }

  // Find package
  const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, body.packageId));
  if (!pkg) {
    return c.json({ success: false, message: "Paket buku tidak ditemukan" }, 404);
  }

  const isScholarship = body.orderType === "scholarship";
  let scholarshipProofUrl: string | null = null;

  // Handle scholarship proof upload
  if (isScholarship) {
    if (!body.scholarshipProofBase64) {
      return c.json({ success: false, message: "Surat tanda beasiswa wajib dilampirkan" }, 400);
    }
    const key = `scholarships/${student.id}_${Date.now()}.jpg`;
    const buffer = Buffer.from(body.scholarshipProofBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    scholarshipProofUrl = await defaultStorage.upload(key, buffer, "image/jpeg");
  }

  // Calculate pricing: 100% discount for scholarship
  const totalAmount = isScholarship ? 0 : pkg.price;
  let paidAmount = 0;
  let paymentStatus: any = isScholarship ? "scholarship_pending" : "unpaid";

  // Handle optional payment proof
  if (!isScholarship && body.payment && body.payment.bookAllocationAmount > 0) {
    let paymentProofUrl: string | null = null;
    if (body.payment.paymentProofBase64) {
      const key = `payments/${orderId}_${Date.now()}.jpg`;
      const buffer = Buffer.from(body.payment.paymentProofBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
      paymentProofUrl = await defaultStorage.upload(key, buffer, "image/jpeg");
    }

    paidAmount = body.payment.bookAllocationAmount;
    paymentStatus = paidAmount >= totalAmount ? "paid" : "partial";

    await db.insert(orderPayments).values({
      id: crypto.randomUUID(),
      orderId,
      transferAmount: body.payment.transferAmount,
      bookAllocationAmount: body.payment.bookAllocationAmount,
      paymentProofUrl,
      bankName: body.payment.bankName || null,
      referenceNumber: body.payment.referenceNumber || null,
      notes: "Submitted via Public Form",
      createdAt: now,
    });
  }

  // Create order
  await db.insert(studentBookOrders).values({
    id: orderId,
    orderNumber,
    studentId: student.id,
    schoolId: student.schoolId,
    packageId: pkg.id,
    orderType: body.orderType,
    paymentStatus,
    fulfillmentStatus: "waiting_preparation",
    totalAmount,
    paidAmount,
    scholarshipProofUrl,
    notes: body.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  const [orderRecord] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));

  return c.json({
    success: true,
    message: "Pesanan buku berhasil dibuat!",
    data: {
      order: orderRecord,
      studentName: student.name,
      packageName: pkg.name,
      totalAmount,
      paidAmount,
      paymentStatus,
    },
  }, 201);
});

// 4. Public Lookup Order for Defect Return (by Order Number or Student NIS)
publicOrdersRouter.get("/lookup-order", async (c) => {
  const query = c.req.query("query")?.trim();
  if (!query || query.length < 3) {
    return c.json({ success: false, message: "Masukkan minimal 3 karakter No. Pesanan atau NIS" }, 400);
  }

  // Find order by orderNumber or student NIS
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
    .where(
      or(
        like(studentBookOrders.orderNumber, `%${query}%`),
        like(students.nis, `%${query}%`),
        like(students.name, `%${query}%`)
      )
    )
    .limit(5);

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
  const now = new Date().toISOString();
  const returnId = crypto.randomUUID();

  // Validate order existence
  const [order] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, body.orderId));
  if (!order) {
    return c.json({ success: false, message: "Data pesanan tidak ditemukan" }, 404);
  }

  let photoProofUrl: string | null = null;
  if (body.photoProofBase64) {
    const key = `returns/public_${returnId}_${Date.now()}.jpg`;
    const buffer = Buffer.from(body.photoProofBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    photoProofUrl = await defaultStorage.upload(key, buffer, "image/jpeg");
  }

  // Import bookReturns schema
  const { bookReturns } = await import("../../db/schema");
  await db.insert(bookReturns).values({
    id: returnId,
    orderId: body.orderId,
    studentId: body.studentId,
    defectiveBookId: body.defectiveBookId,
    reason: body.reason,
    photoProofUrl,
    status: "reported",
    createdAt: now,
    updatedAt: now,
  });

  // Flag order fulfillment status
  await db
    .update(studentBookOrders)
    .set({ fulfillmentStatus: "return_in_progress", updatedAt: now })
    .where(eq(studentBookOrders.id, body.orderId));

  return c.json({
    success: true,
    message: "Laporan retur buku rusak berhasil dikirimkan. Tim logistik sekolah akan segera memproses penggantian fisik buku Anda.",
    data: {
      returnId,
      orderNumber: order.orderNumber,
      status: "reported",
    },
  }, 201);
});
