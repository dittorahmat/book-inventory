import type { AppDatabase } from "../../db";
import { schools, students, studentBookOrders, bookPackages, books, uniformVariants, uniformPackages } from "../../db/schema";

export interface TestSchoolOverrides {
  id?: string;
  name?: string;
  code?: string;
  type?: "main" | "branch" | "warehouse";
}

export async function createTestSchool(
  database: AppDatabase,
  overrides: TestSchoolOverrides = {}
) {
  const stamp = Date.now().toString() + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const row = {
    id: overrides.id ?? `sch-test-${stamp}`,
    name: overrides.name ?? `Sekolah Uji ${stamp}`,
    code: overrides.code ?? `SCH-${stamp.slice(-4).toUpperCase()}`,
    type: overrides.type ?? ("branch" as const),
    address: "Jl. Uji Coba No. 1",
    createdAt: now,
    updatedAt: now,
  };
  await database.insert(schools).values(row).onConflictDoNothing();
  return row;
}

export interface TestStudentOverrides {
  id?: string;
  schoolId?: string;
  nis?: string;
  name?: string;
  gender?: "male" | "female";
  gradeLevel?: string;
  curriculumType?: "international" | "national";
  academicYear?: string;
  status?: "active" | "promoted" | "graduated" | "new_pending" | "rejected";
}

export async function createTestStudent(
  database: AppDatabase,
  overrides: TestStudentOverrides = {}
) {
  const stamp = Date.now().toString() + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const schoolId = overrides.schoolId ?? (await createTestSchool(database)).id;
  const row = {
    id: overrides.id ?? `stu-test-${stamp}`,
    schoolId,
    nis: overrides.nis ?? `NIS-${stamp.slice(-6)}`,
    name: overrides.name ?? `Siswa Uji ${stamp}`,
    gender: overrides.gender ?? ("male" as const),
    gradeLevel: overrides.gradeLevel ?? "1",
    curriculumType: overrides.curriculumType ?? ("international" as const),
    academicYear: overrides.academicYear ?? "2026/2027",
    status: overrides.status ?? ("active" as const),
    parentName: "Wali Siswa Uji",
    parentEmail: `wali-${stamp}@contoh.id`,
    parentPhone: "081234567890",
    createdAt: now,
    updatedAt: now,
  };
  await database.insert(students).values(row);
  return row;
}

export interface TestBookOrderOverrides {
  id?: string;
  orderNumber?: string;
  studentId?: string;
  schoolId?: string;
  orderType?: "regular" | "scholarship";
  paymentStatus?: "unpaid" | "partial" | "paid" | "scholarship_approved";
  fulfillmentStatus?: "waiting_preparation" | "ready_for_pickup" | "picked_up" | "return_in_progress";
  totalAmount?: number;
  paidAmount?: number;
  packageId?: string | null;
  assignedPackageItemId?: string | null;
}

export async function createTestBookOrder(
  database: AppDatabase,
  overrides: TestBookOrderOverrides = {}
) {
  const stamp = Date.now().toString() + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  let studentId = overrides.studentId;
  let schoolId = overrides.schoolId;

  if (!studentId) {
    const student = await createTestStudent(database, schoolId ? { schoolId } : {});
    studentId = student.id;
    schoolId = student.schoolId;
  } else if (!schoolId) {
    schoolId = (await createTestSchool(database)).id;
  }

  const row = {
    id: overrides.id ?? `ord-test-${stamp}`,
    orderNumber: overrides.orderNumber ?? `ORD-${stamp.slice(-6).toUpperCase()}`,
    studentId,
    schoolId,
    orderType: overrides.orderType ?? ("regular" as const),
    paymentStatus: overrides.paymentStatus ?? ("paid" as const),
    fulfillmentStatus: overrides.fulfillmentStatus ?? ("waiting_preparation" as const),
    totalAmount: overrides.totalAmount ?? 500000,
    paidAmount: overrides.paidAmount ?? 500000,
    packageId: overrides.packageId ?? null,
    assignedPackageItemId: overrides.assignedPackageItemId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await database.insert(studentBookOrders).values(row);
  return row;
}

export interface TestPackageOverrides {
  id?: string;
  code?: string;
  name?: string;
  gradeLevel?: string;
  curriculumType?: "international" | "national";
  academicYear?: string;
  price?: number;
}

export async function createTestPackage(
  database: AppDatabase,
  overrides: TestPackageOverrides = {}
) {
  const stamp = Date.now().toString() + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const row = {
    id: overrides.id ?? `pkg-test-${stamp}`,
    code: overrides.code ?? `PKG-${stamp.slice(-6).toUpperCase()}`,
    name: overrides.name ?? `Paket Uji ${stamp}`,
    gradeLevel: overrides.gradeLevel ?? "1",
    curriculumType: overrides.curriculumType ?? ("international" as const),
    academicYear: overrides.academicYear ?? "2026/2027",
    price: overrides.price ?? 500000,
    createdAt: now,
    updatedAt: now,
  };
  await database.insert(bookPackages).values(row).onConflictDoNothing();
  return row;
}

export interface TestBookOverrides {
  id?: string;
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  gradeLevel?: string;
  curriculumType?: "international" | "national";
  academicYear?: string;
  sellPrice?: number;
}

export async function createTestBook(
  database: AppDatabase,
  overrides: TestBookOverrides = {}
) {
  const stamp = Date.now().toString() + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const row = {
    id: overrides.id ?? `book-test-${stamp}`,
    isbn: overrides.isbn ?? `ISBN-${stamp.slice(-6).toUpperCase()}`,
    title: overrides.title ?? `Buku Uji ${stamp}`,
    author: overrides.author ?? "Penulis Uji",
    publisher: overrides.publisher ?? "Penerbit Uji",
    gradeLevel: overrides.gradeLevel ?? "1",
    curriculumType: overrides.curriculumType ?? ("international" as const),
    academicYear: overrides.academicYear ?? "2026/2027",
    sellPrice: overrides.sellPrice ?? 100000,
    createdAt: now,
    updatedAt: now,
  };
  await database.insert(books).values(row).onConflictDoNothing();
  return row;
}

export interface TestUniformVariantOverrides {
  id?: string;
  code?: string;
  name?: string;
  kind?: "kain_harian" | "olahraga";
  gender?: "male" | "female";
  jenjang?: "tk" | "sd" | "smp" | "sma";
  academicYear?: string;
  price?: number;
}

export async function createTestUniformVariant(
  database: AppDatabase,
  overrides: TestUniformVariantOverrides = {}
) {
  const stamp = Date.now().toString() + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const row = {
    id: overrides.id ?? `uv-test-${stamp}`,
    code: overrides.code ?? `UV-${stamp.slice(-6).toUpperCase()}`,
    name: overrides.name ?? `Seragam Uji ${stamp}`,
    kind: overrides.kind ?? ("olahraga" as const),
    gender: overrides.gender ?? ("male" as const),
    jenjang: overrides.jenjang ?? ("sd" as const),
    academicYear: overrides.academicYear ?? "2026/2027",
    price: overrides.price ?? 100000,
    createdAt: now,
    updatedAt: now,
  };
  await database.insert(uniformVariants).values(row).onConflictDoNothing();
  return row;
}

export interface TestUniformPackageOverrides {
  id?: string;
  code?: string;
  name?: string;
  academicYear?: string;
  price?: number;
}

export async function createTestUniformPackage(
  database: AppDatabase,
  overrides: TestUniformPackageOverrides = {}
) {
  const stamp = Date.now().toString() + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const row = {
    id: overrides.id ?? `up-test-${stamp}`,
    code: overrides.code ?? `UP-${stamp.slice(-6).toUpperCase()}`,
    name: overrides.name ?? `Paket Seragam Uji ${stamp}`,
    academicYear: overrides.academicYear ?? "2026/2027",
    price: overrides.price ?? 250000,
    createdAt: now,
    updatedAt: now,
  };
  await database.insert(uniformPackages).values(row).onConflictDoNothing();
  return row;
}

