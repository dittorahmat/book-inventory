import { useState, useEffect } from "react";
import type { School } from "../types";
import { Search, Plus, AlertCircle, Users, Loader2 } from "lucide-react";
import { SearchableSingleSelect } from "../components/ui/SearchableSingleSelect";
import { useStudents } from "../components/students/useStudents";
import { fetchSchools } from "../components/students/students-api";
import type { SchoolOption } from "../components/students/students-api";
import { StudentTable } from "../components/students/StudentTable";
import { VerificationQueue } from "../components/students/VerificationQueue";
import { StudentFormModal } from "../components/students/StudentFormModal";
import { StudentBulkUploadModal } from "../components/students/StudentBulkUploadModal";
import { BatchPromoteModal } from "../components/students/BatchPromoteModal";
import { Upload, GraduationCap } from "lucide-react";

interface StudentsViewProps {
  activeSchool: School | null;
  schools?: SchoolOption[];
}

export function StudentsView({ activeSchool, schools: initialSchools }: StudentsViewProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(activeSchool?.id ?? "all");
  const currentSchoolId = selectedSchoolId === "all" ? null : selectedSchoolId;
  const s = useStudents(currentSchoolId);
  const [schools, setSchools] = useState<SchoolOption[]>(initialSchools || []);
  const [showBulkUpload, setShowBulkUpload] = useState<boolean>(false);
  const [showBatchPromote, setShowBatchPromote] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const { setError } = s;

  useEffect(() => {
    if (activeSchool?.id) {
      setSelectedSchoolId(activeSchool.id);
    }
  }, [activeSchool?.id]);

  useEffect(() => {
    if (schools.length === 0) {
      fetchSchools()
        .then(setSchools)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat daftar sekolah."));
    }
  }, [schools.length, setError]);

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBatchPromote(true)}
            className="px-3.5 py-2.5 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] text-[#050505] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>Kenaikan Kelas</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBulkUpload(true)}
            className="px-3.5 py-2.5 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] text-[#050505] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Upload className="w-4 h-4 text-[#1877F2]" />
            <span>Bulk Upload</span>
          </button>
          <button
            type="button"
            onClick={s.openCreate}
            className="px-4 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="w-full sm:w-56">
          <SearchableSingleSelect
            options={[
              { value: "all", label: "Semua Cabang / Sekolah" },
              ...schools.map((sc) => ({ value: sc.id, label: sc.name })),
            ]}
            value={selectedSchoolId}
            onChange={(v) => setSelectedSchoolId(v)}
            placeholder="Pilih Cabang..."
          />
        </div>
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
        <div className="w-full sm:w-56">
          <SearchableSingleSelect
            options={[
              { value: "all", label: "Semua Status" },
              { value: "new_pending", label: "Menunggu Verifikasi" },
              { value: "active", label: "Aktif" },
              { value: "promoted", label: "Naik Kelas" },
              { value: "rejected", label: "Ditolak" },
              { value: "graduated", label: "Lulus" },
            ]}
            value={s.statusFilter}
            onChange={(v) => s.setStatusFilter(v as typeof s.statusFilter)}
            placeholder="Filter status..."
          />
        </div>
      </div>

      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800 font-semibold">
          <span>{successBanner}</span>
          <button type="button" onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-900">
            Tutup
          </button>
        </div>
      )}

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

      {showBulkUpload && (
        <StudentBulkUploadModal
          schoolId={activeSchool?.id ?? (schools[0]?.id || null)}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            s.load();
          }}
        />
      )}

      {showBatchPromote && (
        <BatchPromoteModal
          schools={schools}
          defaultSchoolId={selectedSchoolId}
          onClose={() => setShowBatchPromote(false)}
          onSuccess={(msg) => {
            setSuccessBanner(msg);
            s.load();
          }}
        />
      )}
    </div>
  );
}
