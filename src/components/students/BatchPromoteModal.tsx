import { useState } from "react";
import { X, GraduationCap, Loader2, AlertCircle } from "lucide-react";
import { postJson } from "../../lib/api";
import type { SchoolOption } from "./students-api";

interface BatchPromoteModalProps {
  schools: SchoolOption[];
  defaultSchoolId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function BatchPromoteModal({
  schools,
  defaultSchoolId,
  onClose,
  onSuccess,
}: BatchPromoteModalProps) {
  const [schoolId, setSchoolId] = useState(defaultSchoolId === "all" ? (schools[0]?.id ?? "") : defaultSchoolId);
  const [targetAcademicYear, setTargetAcademicYear] = useState("2026/2027");
  const [maxGradeLevel, setMaxGradeLevel] = useState<number>(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) {
      setErrorMsg("Pilih cabang/sekolah terlebih dahulu.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await postJson<{ message: string; data: { promotedCount: number; graduatedCount: number; skippedCount: number } }>(
        "/api/students/batch-promote",
        {
          schoolId,
          targetAcademicYear,
          maxGradeLevel,
          excludeStudentIds: [],
        },
        "Gagal memproses kenaikan kelas masal"
      );
      onSuccess(res.message);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memproses kenaikan kelas.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#E7F3FF] text-[#1877F2] flex items-center justify-center font-bold">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Kenaikan Kelas Masal (Tahun Ajaran Baru)</h3>
              <p className="text-[11px] text-[#65676B]">Promosikan seluruh siswa aktif ke tingkat kelas berikutnya</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1 text-[#050505]">Pilih Cabang / Sekolah *</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            >
              {schools.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-[#050505]">Tahun Ajaran Baru *</label>
            <input
              type="text"
              required
              value={targetAcademicYear}
              onChange={(e) => setTargetAcademicYear(e.target.value)}
              placeholder="Contoh: 2026/2027"
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-[#050505]">Batas Kelas Akhir (Lulus / Alumni)</label>
            <input
              type="number"
              min={1}
              max={12}
              value={maxGradeLevel}
              onChange={(e) => setMaxGradeLevel(Math.max(1, Number(e.target.value) || 6))}
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
            <p className="text-[10px] text-[#65676B] mt-1">
              Siswa di kelas {maxGradeLevel} akan otomatis ditandai <strong>Lulus (Graduated)</strong>, sedangkan kelas di bawahnya naik 1 tingkat.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-xl font-semibold text-[#65676B]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Jalankan Kenaikan Kelas</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
