import { students } from "../../db/schema";
import type { SeedContext } from "./context";

export const STUDENT_DATA = [
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

export async function seedStudents({ db: targetDb, now }: SeedContext) {
  for (const st of STUDENT_DATA) {
    await targetDb
      .insert(students)
      .values({ ...st, createdAt: now, updatedAt: now })
      .onConflictDoNothing();
  }
}
