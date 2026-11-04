import { apiEnvelope } from "../../lib/api";
import type { ParsedStudentRow } from "../../lib/student-import-parser";

export const SAMPLE_STUDENT_CSV =
  "nis,nama,kelas,jk,tahun_ajaran\n" +
  "262710001,ABIZAR ZAFRAN BINTORO,1.INTER 1,Male,2026/2027\n" +
  "262710002,ABQARY SALAHUDDIN WIBOWO,1.INTER 1,Male,2026/2027\n" +
  "262710003,FATIMAH AZZAHRA,2.MQ 1,Female,2026/2027\n";

export function downloadSampleStudentTemplate() {
  const blob = new Blob([SAMPLE_STUDENT_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "template_import_siswa.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function submitStudentsInChunks(params: {
  schoolId: string;
  students: ParsedStudentRow[];
}): Promise<{ totalInserted: number; totalUpdated: number }> {
  const CHUNK_SIZE = 50;
  let totalInserted = 0;
  let totalUpdated = 0;

  for (let i = 0; i < params.students.length; i += CHUNK_SIZE) {
    const batch = params.students.slice(i, i + CHUNK_SIZE);
    const res = await apiEnvelope<{
      success: boolean;
      message: string;
      data: { insertedCount: number; updatedCount: number };
    }>("/api/students/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: params.schoolId,
        students: batch,
      }),
    });

    if (res.data) {
      totalInserted += res.data.insertedCount;
      totalUpdated += res.data.updatedCount;
    }
  }

  return { totalInserted, totalUpdated };
}
