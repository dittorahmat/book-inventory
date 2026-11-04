import type { ParsedStudentRow, SkippedStudentRow } from "../../lib/student-import-parser";
import { AlertCircle } from "lucide-react";

interface StudentImportPreviewProps {
  parsedStudents: ParsedStudentRow[];
  skippedRows: SkippedStudentRow[];
  sheetName: string;
  totalRawRead?: number;
}

export function StudentImportPreview({
  parsedStudents,
  skippedRows,
  sheetName,
  totalRawRead,
}: StudentImportPreviewProps) {
  const duplicatesSkipped =
    typeof totalRawRead === "number" && totalRawRead > parsedStudents.length
      ? totalRawRead - parsedStudents.length
      : 0;

  return (
    <div className="space-y-3">
      {parsedStudents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#050505]">
              Pratinjau Hasil Pembacaan {sheetName && `(Sheet: ${sheetName})`}
            </span>
            <div className="text-right">
              <span className="text-emerald-600 font-bold">
                {parsedStudents.length} siswa unik siap diimpor
              </span>
              {duplicatesSkipped > 0 && (
                <div className="text-[10px] text-[#65676B]">
                  ({duplicatesSkipped} duplikat NIS otomatis diabaikan)
                </div>
              )}
            </div>
          </div>

          <div className="border border-[#E4E6EB] rounded-xl overflow-hidden max-h-40 overflow-y-auto text-[11px]">
            <table className="w-full text-left">
              <thead className="bg-[#F0F2F5] text-[#65676B] sticky top-0">
                <tr>
                  <th className="p-2">NIS</th>
                  <th className="p-2">Nama</th>
                  <th className="p-2">Kelas</th>
                  <th className="p-2">Kurikulum</th>
                  <th className="p-2">Gender</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E6EB]">
                {parsedStudents.slice(0, 5).map((s) => (
                  <tr key={s.nis} className="hover:bg-gray-50">
                    <td className="p-2 font-mono">{s.nis}</td>
                    <td className="p-2 font-medium text-[#050505]">{s.name}</td>
                    <td className="p-2">Kelas {s.gradeLevel}</td>
                    <td className="p-2 capitalize">{s.curriculumType}</td>
                    <td className="p-2 capitalize">{s.gender}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedStudents.length > 5 && (
            <div className="text-[11px] text-[#65676B] text-center">
              ... dan {parsedStudents.length - 5} siswa lainnya siap diimpor.
            </div>
          )}
        </div>
      )}

      {skippedRows.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-800">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            {skippedRows.length} baris dilewati (status khusus / kelas tidak valid):
          </div>
          <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-700">
            {skippedRows.slice(0, 3).map((sk) => (
              <li key={sk.rowNumber}>
                Baris {sk.rowNumber}: {sk.reason}
              </li>
            ))}
            {skippedRows.length > 3 && <li>... dan {skippedRows.length - 3} baris lainnya.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
