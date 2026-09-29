import { Pencil, Trash2 } from "lucide-react";
import type { StudentRecord } from "./students-api";

interface StudentTableProps {
  students: StudentRecord[];
  onEdit: (st: StudentRecord) => void;
  onDelete: (id: string) => void;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  promoted: "bg-[#E7F3FF] text-[#1877F2] border-[#1877F2]/20",
  new_pending: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  graduated: "bg-[#F0F2F5] text-[#65676B] border-[#CED0D4]",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  promoted: "Naik Kelas",
  new_pending: "Menunggu",
  rejected: "Ditolak",
  graduated: "Lulus",
};

export function StudentTable({ students, onEdit, onDelete }: StudentTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
      <div className="divide-y divide-[#E4E6EB]">
        {students.map((st) => (
          <div key={st.id} className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#E7F3FF] text-[#1877F2] flex items-center justify-center text-xs font-bold shrink-0">
              {st.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#050505] truncate">{st.name}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[st.status] || STATUS_STYLE.graduated}`}
                >
                  {STATUS_LABEL[st.status] || st.status}
                </span>
              </div>
              <div className="text-[11px] text-[#65676B] mt-0.5">
                NIS {st.nis} &bull; Kelas {st.gradeLevel} (
                {st.curriculumType === "international" ? "Internasional" : "Nasional"}) &bull; {st.schoolName}
              </div>
              {st.status === "new_pending" && (
                <div className="text-[11px] text-amber-700 mt-0.5">
                  Kelola persetujuan di Antrian Verifikasi di atas.
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(st)}
                title="Ubah data siswa"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#F0F2F5] hover:bg-[#E4E6EB] active:scale-[0.98] transition-all"
              >
                <Pencil className="w-3.5 h-3.5 text-[#050505]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Hapus data ${st.name}? Tindakan ini tidak bisa dibatalkan.`)) {
                    onDelete(st.id);
                  }
                }}
                title="Hapus data siswa"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
