import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { SchoolOption, StudentFormPayload, StudentRecord } from "./students-api";

interface StudentFormModalProps {
  schools: SchoolOption[];
  defaultSchoolId: string | null;
  initial: StudentRecord | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: StudentFormPayload) => Promise<void>;
}

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function StudentFormModal({
  schools,
  defaultSchoolId,
  initial,
  saving,
  onClose,
  onSave,
}: StudentFormModalProps) {
  const [schoolId, setSchoolId] = useState(initial?.schoolId || defaultSchoolId || schools[0]?.id || "");
  const [nis, setNis] = useState(initial?.nis || "");
  const [name, setName] = useState(initial?.name || "");
  const [gender, setGender] = useState<"male" | "female">(
    initial?.gender === "female" ? "female" : "male"
  );
  const [gradeLevel, setGradeLevel] = useState(initial?.gradeLevel || "1");
  const [curriculumType, setCurriculumType] = useState<"international" | "national">(
    initial?.curriculumType === "national" ? "national" : "international"
  );
  const [academicYear, setAcademicYear] = useState(initial?.academicYear || "2026/2027");
  const [status, setStatus] = useState(initial?.status || "active");
  const [parentName, setParentName] = useState(initial?.parentName || "");
  const [parentEmail, setParentEmail] = useState(initial?.parentEmail || "");
  const [parentPhone, setParentPhone] = useState(initial?.parentPhone || "");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!schoolId) {
      setFormError("Sekolah wajib dipilih.");
      return;
    }
    if (!nis.trim() || !name.trim()) {
      setFormError("NIS dan nama murid wajib diisi.");
      return;
    }
    try {
      await onSave({
        schoolId,
        nis: nis.trim(),
        name: name.trim(),
        gender,
        gradeLevel,
        curriculumType,
        academicYear: academicYear.trim() || "2026/2027",
        parentName: parentName.trim() || undefined,
        parentEmail: parentEmail.trim() || undefined,
        parentPhone: parentPhone.trim() || undefined,
        status,
      });
    } catch {
      setFormError("Gagal menyimpan. Periksa pesan error di halaman utama.");
    }
  };

  const inputCls =
    "w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]";
  const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E6EB] sticky top-0 bg-white">
          <span className="text-sm font-bold text-[#050505]">
            {initial ? "Ubah Data Siswa" : "Tambah Siswa Baru"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F0F2F5] active:scale-[0.98] transition-all"
          >
            <X className="w-4 h-4 text-[#65676B]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Sekolah</label>
              <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>NIS</label>
              <input type="text" value={nis} onChange={(e) => setNis(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nama Lengkap Murid</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Jenis Kelamin</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")} className={inputCls}>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Kelas</label>
              <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={inputCls}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Kelas {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Kurikulum</label>
              <select
                value={curriculumType}
                onChange={(e) => setCurriculumType(e.target.value as "international" | "national")}
                className={inputCls}
              >
                <option value="international">Internasional</option>
                <option value="national">Nasional</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Tahun Ajaran</label>
              <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                <option value="active">Aktif</option>
                <option value="promoted">Naik Kelas</option>
                <option value="new_pending">Menunggu Verifikasi</option>
                <option value="rejected">Ditolak</option>
                <option value="graduated">Lulus</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nama Orang Tua</label>
              <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>No. HP / WA Orang Tua</label>
              <input type="text" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Email Orang Tua</label>
              <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98] transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{saving ? "Menyimpan..." : "Simpan"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
