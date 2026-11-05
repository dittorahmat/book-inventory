import { and, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { students } from "../../db/schema";
import { chunkRows } from "../lib/d1-write";

export interface BatchPromoteInput {
  schoolId: string;
  targetAcademicYear: string;
  excludeStudentIds?: string[];
  maxGradeLevel?: number;
}

export interface BatchPromoteResult {
  promotedCount: number;
  graduatedCount: number;
  skippedCount: number;
}

/**
 * Mempromosikan siswa secara masal ke tingkat kelas berikutnya:
 * - Siswa di kelas numerik dinaikkan 1 tingkat (misal 1 -> 2).
 * - Siswa yang mencapai maxGradeLevel (default 6 untuk SD) ditandai graduated (lulus).
 * - Status siswa menjadi 'promoted'.
 * - Siswa dalam excludeStudentIds (tinggal kelas) dilewati.
 */
export async function batchPromoteStudents(
  database: AppDatabase,
  input: BatchPromoteInput,
  now = new Date().toISOString()
): Promise<{ ok: true; data: BatchPromoteResult } | { ok: false; status: ContentfulStatusCode; message: string }> {
  const maxGrade = input.maxGradeLevel ?? 6;
  const excluded = new Set(input.excludeStudentIds ?? []);

  const eligibleStudents = await database
    .select()
    .from(students)
    .where(and(eq(students.schoolId, input.schoolId), inArray(students.status, ["active", "promoted"])));

  let promotedCount = 0;
  let graduatedCount = 0;
  let skippedCount = 0;

  const toGraduateIds: string[] = [];
  const toPromoteByGrade = new Map<string, string[]>();

  for (const st of eligibleStudents) {
    if (excluded.has(st.id)) {
      skippedCount++;
      continue;
    }

    const currentGrade = parseInt(st.gradeLevel, 10);
    if (Number.isNaN(currentGrade)) {
      skippedCount++;
      continue;
    }

    if (currentGrade >= maxGrade) {
      toGraduateIds.push(st.id);
      graduatedCount++;
    } else {
      const nextGrade = (currentGrade + 1).toString();
      const list = toPromoteByGrade.get(nextGrade) ?? [];
      list.push(st.id);
      toPromoteByGrade.set(nextGrade, list);
      promotedCount++;
    }
  }

  // Batch updates chunked to meet Cloudflare D1 discipline
  if (toGraduateIds.length > 0) {
    for (const chunk of chunkRows(toGraduateIds)) {
      await database
        .update(students)
        .set({
          status: "graduated",
          academicYear: input.targetAcademicYear,
          updatedAt: now,
        })
        .where(inArray(students.id, chunk));
    }
  }

  for (const [nextGrade, ids] of toPromoteByGrade.entries()) {
    for (const chunk of chunkRows(ids)) {
      await database
        .update(students)
        .set({
          gradeLevel: nextGrade,
          status: "promoted",
          academicYear: input.targetAcademicYear,
          updatedAt: now,
        })
        .where(inArray(students.id, chunk));
    }
  }

  return {
    ok: true,
    data: {
      promotedCount,
      graduatedCount,
      skippedCount,
    },
  };
}
