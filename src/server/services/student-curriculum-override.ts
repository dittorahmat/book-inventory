import { eq, and, ne, inArray } from "drizzle-orm";
import { type AppDatabase } from "../../db";
import {
  students,
  schools,
  studentBookOrders,
  bookPackages,
  bookReturns,
  type CurriculumType,
  type StreamType,
} from "../../db/schema";
import { toBookSearchView } from "./public-order";
import { getAvailableCurriculaForGrade } from "../../lib/curriculum";
import { resolveLockedPackage } from "../../lib/resolve-package";
import { handleOrderReplacement, type PaymentReallocationResult } from "./order-reallocation";
import { LOGISTICS_ROLES, type AccessActor } from "./access-scope";
import { newWriteId, writeNow, type WriteDeps } from "../lib/d1-write";
import { documentNumber, isoTimeFragment, randomSerial } from "../lib/document-number";

export interface ProgramChangeRequest {
  studentId: string;
  nis: string;
  parentName: string;
  parentPhone: string;
  curriculumType: CurriculumType;
  stream?: StreamType | null;
  schoolApprovalProofBase64?: string;
  actor?: AccessActor | null;
}

export type ProgramChangeResult =
  | {
      ok: true;
      data: ReturnType<typeof toBookSearchView>;
      replacementResult?: PaymentReallocationResult;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409 | 500;
      message: string;
    };

export type UpdateStudentCurriculumInput = Omit<ProgramChangeRequest, "studentId">;
export type UpdateStudentCurriculumResult = ProgramChangeResult;

/**
 * Deep Domain Engine: Mengatur siklus hidup pergantian program & peminatan siswa.
 * Mengenkapsulasi:
 * 1. Otorisasi peran (Logistik Pusat / PIC Cabang).
 * 2. Validasi bukti surat persetujuan sekolah.
 * 3. Guard fisik serah terima (mencegah ganti program jika buku sudah picked_up tanpa retur).
 * 4. Penimpaan pesanan lama secara atomik via handleOrderReplacement & Payment-Ledger.
 * 5. Pembaruan data siswa dan penyelarasan view pencarian buku.
 */
export async function changeStudentProgram(
  database: AppDatabase,
  request: ProgramChangeRequest,
  deps?: WriteDeps
): Promise<ProgramChangeResult> {
  const { studentId, actor } = request;

  // 1. Guard Peran (Issue #385): hanya LOGISTICS_ROLES atau branch_admin
  if (!actor) {
    return {
      ok: false,
      status: 403,
      message: "Perubahan program siswa hanya diizinkan untuk staf berwenang (Logistik Pusat atau Admin Cabang)",
    };
  }
  const isLogistics = LOGISTICS_ROLES.includes(actor.role);
  const isBranchAdmin = actor.role === "branch_admin";
  if (!isLogistics && !isBranchAdmin) {
    return {
      ok: false,
      status: 403,
      message: "Perubahan program siswa hanya diizinkan untuk Logistik Pusat atau Admin Cabang",
    };
  }

  // 2. Guard Lampiran Persetujuan Sekolah (Issue #385)
  if (!request.schoolApprovalProofBase64 || !request.schoolApprovalProofBase64.trim()) {
    return {
      ok: false,
      status: 400,
      message: "Surat persetujuan mutasi program dari sekolah wajib dilampirkan",
    };
  }

  const [existing] = await database
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      schoolId: students.schoolId,
      schoolName: schools.name,
      gradeLevel: students.gradeLevel,
      curriculumType: students.curriculumType,
      stream: students.stream,
      academicYear: students.academicYear,
      status: students.status,
      isScholarship: students.isScholarship,
      gender: students.gender,
      parentName: students.parentName,
      parentEmail: students.parentEmail,
      parentPhone: students.parentPhone,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(eq(students.id, studentId));

  if (!existing) {
    return {
      ok: false,
      status: 404,
      message: "Data siswa tidak ditemukan",
    };
  }

  if (existing.nis.trim() !== request.nis.trim()) {
    return {
      ok: false,
      status: 400,
      message: "NIS tidak sesuai dengan data siswa terdaftar",
    };
  }

  const allowedCurricula = getAvailableCurriculaForGrade(existing.gradeLevel).map((c) => c.value);
  if (!allowedCurricula.includes(request.curriculumType)) {
    return {
      ok: false,
      status: 400,
      message: `Pilihan program tidak tersedia untuk tingkat kelas ${existing.gradeLevel}`,
    };
  }

  // 3. Guard Status Pesanan Fisik (Issue #385)
  const activeOrders = await database
    .select()
    .from(studentBookOrders)
    .where(
      and(
        eq(studentBookOrders.studentId, studentId),
        ne(studentBookOrders.fulfillmentStatus, "superseded")
      )
    );

  const pickedUpOrders = activeOrders.filter((o) => o.fulfillmentStatus === "picked_up");
  if (pickedUpOrders.length > 0) {
    const pickedUpOrderIds = pickedUpOrders.map((o) => o.id);
    const existingReturns = await database
      .select({ orderId: bookReturns.orderId })
      .from(bookReturns)
      .where(
        and(
          inArray(bookReturns.orderId, pickedUpOrderIds),
          inArray(bookReturns.status, ["reported", "approved", "replaced", "refunded"])
        )
      );

    const returnedOrderIds = new Set(existingReturns.map((r) => r.orderId));
    const unreturnedPickedUp = pickedUpOrders.find((o) => !returnedOrderIds.has(o.id));
    if (unreturnedPickedUp) {
      return {
        ok: false,
        status: 400,
        message: "Buku fisik sudah diambil (picked_up). Lakukan retur fisik buku lama terlebih dahulu sebelum mengubah program.",
      };
    }
  }

  const now = writeNow(deps);
  await database
    .update(students)
    .set({
      curriculumType: request.curriculumType,
      stream: request.stream ?? null,
      parentName: request.parentName.trim(),
      parentPhone: request.parentPhone.trim(),
      updatedAt: now,
    })
    .where(eq(students.id, studentId));

  const updatedRow = {
    ...existing,
    curriculumType: request.curriculumType,
    stream: request.stream ?? null,
    parentName: request.parentName.trim(),
    parentPhone: request.parentPhone.trim(),
  };

  // 4. Jika ada pesanan belum diambil (waiting_preparation / ready_for_pickup), perbarui pesanan dan realokasi
  const pendingOrder = activeOrders.find(
    (o) => o.fulfillmentStatus === "waiting_preparation" || o.fulfillmentStatus === "ready_for_pickup"
  );

  let replacementResult: PaymentReallocationResult | undefined = undefined;
  if (pendingOrder) {
    const candidatePackages = await database
      .select({
        id: bookPackages.id,
        code: bookPackages.code,
        name: bookPackages.name,
        gradeLevel: bookPackages.gradeLevel,
        curriculumType: bookPackages.curriculumType,
        stream: bookPackages.stream,
        academicYear: bookPackages.academicYear,
        price: bookPackages.price,
      })
      .from(bookPackages)
      .where(
        and(
          eq(bookPackages.gradeLevel, existing.gradeLevel),
          eq(bookPackages.academicYear, existing.academicYear)
        )
      );

    const targetPackage = resolveLockedPackage(
      {
        targetGradeLevel: existing.gradeLevel,
        curriculumType: request.curriculumType,
        stream: request.stream ?? null,
      },
      candidatePackages
    );

    if (targetPackage) {
      const newOrderId = newWriteId(deps);
      const newOrderNumber = documentNumber("ORD", isoTimeFragment(now, 6), randomSerial(4));

      try {
        await database.insert(studentBookOrders).values({
          id: newOrderId,
          orderNumber: newOrderNumber,
          studentId,
          schoolId: existing.schoolId,
          packageId: targetPackage.id,
          orderType: pendingOrder.orderType,
          paymentStatus: "unpaid",
          fulfillmentStatus: "waiting_preparation",
          totalAmount: targetPackage.price,
          paidAmount: 0,
          createdAt: now,
          updatedAt: now,
        });

        const rep = await handleOrderReplacement(database, {
          kind: "buku",
          oldOrderId: pendingOrder.id,
          newOrderId,
        });

        if (!rep.ok) {
          await database.delete(studentBookOrders).where(eq(studentBookOrders.id, newOrderId));
          return {
            ok: false,
            status: rep.status ?? 400,
            message: rep.message ?? "Gagal merealokasikan pesanan buku pengganti",
          };
        }
        replacementResult = rep;
      } catch (err) {
        await database.delete(studentBookOrders).where(eq(studentBookOrders.id, newOrderId));
        throw err;
      }
    }
  }

  const searchView = toBookSearchView(updatedRow);

  return {
    ok: true,
    data: searchView,
    replacementResult,
  };
}

/**
 * Adapter kompatibilitas ke interface lama updateStudentCurriculum
 */
export async function updateStudentCurriculum(
  database: AppDatabase,
  studentId: string,
  input: UpdateStudentCurriculumInput,
  deps?: WriteDeps
): Promise<UpdateStudentCurriculumResult> {
  return changeStudentProgram(
    database,
    {
      ...input,
      studentId,
    },
    deps
  );
}
