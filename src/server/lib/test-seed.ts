import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { books, schools, students } from "../../db/schema";

/**
 * Satu-satunya pemilik seed baris uji: semua kolom NOT NULL terisi
 * (jebakan Okt 2026: `books.author` menggagalkan seed hand-roll),
 * ID unik per tag, `onConflictDoNothing` agar run berulang aman.
 * Test baru wajib memakai ini; 60+ seed hand-roll lama dimigrasi
 * oportunistik, bukan sekaligus.
 */
export const seedSchool = async (tag: string, name = "Seed School"): Promise<string> => {
  const now = new Date().toISOString();
  const id = `school-${tag}`;
  await db.insert(schools).values({ id, name: `${name} ${tag}`, code: `SEED-${tag}`.slice(0, 20), type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
  return id;
};

export const seedStudent = async (tag: string, schoolId: string, name = "Seed Murid", nis?: string): Promise<string> => {
  const now = new Date().toISOString();
  const id = `st-${tag}`;
  await db.insert(students).values({
    id, schoolId, nis: (nis ?? `NIS${tag}`).slice(0, 20), name: `${name} ${tag}`, gradeLevel: "1",
    curriculumType: "international", academicYear: "2026/2027", status: "active",
    parentName: "Ortu", parentEmail: "ortu@example.com", parentPhone: "+628100000001",
    createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
  return id;
};

export const seedBook = async (tag: string, title = "Seed Book"): Promise<string> => {
  const now = new Date().toISOString();
  const id = `b-${tag}`;
  await db.insert(books).values({ id, isbn: `ISBN-${tag}`.slice(0, 30), title: `${title} ${tag}`, author: "Seed", publisher: "Seed", createdAt: now, updatedAt: now }).onConflictDoNothing();
  return id;
};

/** Bersih-bersih urutan FK-aman; order dihapus pemanggil sebelum ini. */
export const dropSeed = async (input: { schoolIds?: string[]; studentIds?: string[]; bookIds?: string[] }): Promise<void> => {
  if (input.bookIds?.length) await db.delete(books).where(inArray(books.id, input.bookIds));
  if (input.studentIds?.length) await db.delete(students).where(inArray(students.id, input.studentIds));
  if (input.schoolIds?.length) await db.delete(schools).where(inArray(schools.id, input.schoolIds));
};
