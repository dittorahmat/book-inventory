import { useState, useEffect } from "react";
import type { School } from "../types";
import { Search, Plus, AlertCircle, Users, Loader2 } from "lucide-react";
import { useStudents } from "../components/students/useStudents";
import { fetchSchools } from "../components/students/students-api";
import type { SchoolOption } from "../components/students/students-api";
import { StudentTable } from "../components/students/StudentTable";
import { VerificationQueue } from "../components/students/VerificationQueue";
import { StudentFormModal } from "../components/students/StudentFormModal";

interface StudentsViewProps {
  activeSchool: School | null;
}

export function StudentsView({ activeSchool }: StudentsViewProps) {
  const s = useStudents(activeSchool?.id ?? null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const { setError } = s;

  useEffect(() => {
    fetchSchools()
      .then(setSchools)
      .catch((err: any) => setError(err.message || "Gagal memuat daftar sekolah."));
  }, [setError]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-[#050505] flex items-center gap-2">
            Database Siswa
            {s.pendingCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                {s.pendingCount} menunggu
              </span>
            )}
          </h1>
          <p className="text-xs text-[#65676B] mt-0.5">
            Kelola master siswa &bull; {activeSchool?.name || "Semua Sekolah"}
          </p>
        </div>
        <button
          type="button"
          onClick={s.openCreate}
          className="px-4 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Siswa</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
          <input
            type="text"
            value={s.search}
            onChange={(e) => s.setSearch(e.target.value)}
            placeholder="Cari nama, NIS, atau orang tua..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E4E6EB] rounded-xl text-xs text-[#050505]"
          />
        </div>
        <select
          value={s.statusFilter}
          onChange={(e) => s.setStatusFilter(e.target.value as typeof s.statusFilter)}
          className="px-3 py-2.5 bg-white border border-[#E4E6EB] rounded-xl text-xs text-[#050505]"
        >
          <option value="all">Semua Status</option>
          <option value="new_pending">Menunggu Verifikasi</option>
          <option value="active">Aktif</option>
          <option value="promoted">Naik Kelas</option>
          <option value="rejected">Ditolak</option>
          <option value="graduated">Lulus</option>
        </select>
      </div>

      {s.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">Perhatian</div>
            <div>{s.error}</div>
          </div>
          <button
            type="button"
            onClick={s.load}
            className="px-3 py-1.5 bg-white border border-red-200 rounded-xl font-semibold hover:bg-red-100 active:scale-[0.98] transition-all"
          >
            Coba Lagi
          </button>
        </div>
      )}

      <VerificationQueue pending={s.pendingList} verifyingId={s.verifyingId} onVerify={s.verify} />

      {s.isLoading ? (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-10 flex flex-col items-center gap-2 text-xs text-[#65676B]">
          <Loader2 className="w-6 h-6 animate-spin text-[#1877F2]" />
          <span>Memuat data siswa...</span>
        </div>
      ) : s.students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-10 flex flex-col items-center gap-2 text-center">
          <Users className="w-8 h-8 text-[#CED0D4]" />
          <div className="text-xs font-bold text-[#050505]">Belum ada data siswa</div>
          <p className="text-xs text-[#65676B] max-w-xs">
            {s.search || s.statusFilter !== "all"
              ? "Tidak ada siswa yang cocok dengan filter. Ubah kata kunci atau filter status."
              : "Tambahkan siswa manual atau tunggu pendaftar baru dari portal orang tua."}
          </p>
        </div>
      ) : (
        <StudentTable students={s.students} onEdit={s.openEdit} onDelete={s.remove} />
      )}

      {s.showForm && (
        <StudentFormModal
          schools={schools}
          defaultSchoolId={activeSchool?.id ?? null}
          initial={s.editing}
          saving={s.isSaving}
          onClose={() => s.setShowForm(false)}
          onSave={s.save}
        />
      )}
    </div>
  );
}
