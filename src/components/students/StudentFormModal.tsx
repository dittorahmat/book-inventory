import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import {
  validateEmail,
  validateNis,
  validatePhone,
  validateRequiredSelect,
  validateRequiredText,
} from "../../lib/form-validation";
import { fetchStudentActiveOrders } from "./students-api";
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
  const [schoolId, setSchoolId] = useState(initial?.schoolId || defaultSchoolId || "");
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
  const [isScholarship, setIsScholarship] = useState(initial?.isScholarship || false);
  const [activeOrders, setActiveOrders] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initial?.id) {
      fetchStudentActiveOrders(initial.id)
        .then((res) => {
          if (res.hasActive) {
            setActiveOrders(res.details);
          }
        })
        .catch(() => {
          // graceful fallback jika gagal periksa
        });
    }
  }, [initial?.id]);

  const hasActiveOrders = activeOrders.length > 0;

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [attempted, setAttempted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAttempted(true);

    const errors: Record<string, string | undefined> = {};
    const schoolCheck = validateRequiredSelect(schoolId, "Sekolah Cabang");
    if (!schoolCheck.valid) errors.schoolId = schoolCheck.message;

    const nisCheck = validateNis(nis);
    if (!nisCheck.valid) errors.nis = nisCheck.message;

    const nameCheck = validateRequiredText(name, "Nama Murid", 2);
    if (!nameCheck.valid) errors.name = nameCheck.message;

    if (parentPhone.trim()) {
      const phoneCheck = validatePhone(parentPhone);
      if (!phoneCheck.valid) errors.parentPhone = phoneCheck.message;
    }

    if (parentEmail.trim()) {
      const emailCheck = validateEmail(parentEmail, false);
      if (!emailCheck.valid) errors.parentEmail = emailCheck.message;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
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
        isScholarship,
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
          {hasActiveOrders && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Siswa memiliki pesanan aktif yang belum selesai:</p>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px]">
                  {activeOrders.map((ord, idx) => (
                    <li key={idx}>{ord}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-amber-700">
                  Sekolah dan Kelas terkunci untuk mencegah mismatch alokasi barang. Selesaikan serah terima atau lakukan alur Ganti Pesanan di portal terlebih dahulu.
                </p>
              </div>
            </div>
          )}
          <FormSummaryAlert errors={attempted ? fieldErrors : {}} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <SearchableSingleSelect
                label="Sekolah"
                options={schools.map((s) => ({ value: s.id, label: s.name, hint: s.code }))}
                value={schoolId}
                onChange={(val) => {
                  setSchoolId(val);
                  if (attempted) setFieldErrors((prev) => ({ ...prev, schoolId: undefined }));
                }}
                placeholder="Pilih sekolah..."
                required
                disabled={hasActiveOrders}
                error={attempted ? fieldErrors.schoolId : undefined}
              />
            </div>
            <div>
              <label className={labelCls}>NIS <span className="text-rose-600">*</span></label>
              <input
                type="text"
                value={nis}
                onChange={(e) => {
                  setNis(e.target.value);
                  if (attempted) setFieldErrors((prev) => ({ ...prev, nis: undefined }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
                  attempted && fieldErrors.nis ? "border-rose-500 ring-1 ring-rose-200" : "border-[#CED0D4]"
                }`}
              />
              <FormFieldFeedback error={attempted ? fieldErrors.nis : undefined} />
            </div>
            <div>
              <label className={labelCls}>Nama Lengkap Murid <span className="text-rose-600">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (attempted) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
                  attempted && fieldErrors.name ? "border-rose-500 ring-1 ring-rose-200" : "border-[#CED0D4]"
                }`}
              />
              <FormFieldFeedback error={attempted ? fieldErrors.name : undefined} />
            </div>
            <div>
              <SearchableSingleSelect
                label="Jenis Kelamin"
                options={[
                  { value: "male", label: "Laki-laki" },
                  { value: "female", label: "Perempuan" },
                ]}
                value={gender}
                onChange={(v) => setGender(v as "male" | "female")}
                placeholder="Pilih..."
              />
            </div>
            <div>
              <SearchableSingleSelect
                label="Kelas"
                options={GRADES.map((g) => ({ value: g, label: `Kelas ${g}` }))}
                value={gradeLevel}
                onChange={setGradeLevel}
                placeholder="Pilih kelas..."
                disabled={hasActiveOrders}
              />
            </div>
            <div>
              <SearchableSingleSelect
                label="Kurikulum"
                options={[
                  { value: "international", label: "Internasional" },
                  { value: "national", label: "Nasional" },
                ]}
                value={curriculumType}
                onChange={(v) => setCurriculumType(v as "international" | "national")}
                placeholder="Pilih..."
              />
            </div>
            <div>
              <label className={labelCls}>Tahun Ajaran</label>
              <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <SearchableSingleSelect
                label="Status"
                options={[
                  { value: "active", label: "Aktif" },
                  { value: "promoted", label: "Naik Kelas" },
                  { value: "new_pending", label: "Menunggu Verifikasi" },
                  { value: "rejected", label: "Ditolak" },
                  { value: "graduated", label: "Lulus" },
                ]}
                value={status}
                onChange={setStatus}
                placeholder="Pilih status..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#050505]">
                <input
                  type="checkbox"
                  checked={isScholarship}
                  onChange={(e) => setIsScholarship(e.target.checked)}
                  className="rounded border-[#CED0D4] text-[#1877F2] focus:ring-[#1877F2]"
                />
                <span>Penerima Beasiswa (Scholarship)</span>
              </label>
            </div>
            <div>
              <label className={labelCls}>Nama Orang Tua</label>
              <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>No. HP / WA Orang Tua</label>
              <input
                type="text"
                value={parentPhone}
                onChange={(e) => {
                  setParentPhone(e.target.value);
                  if (attempted) setFieldErrors((prev) => ({ ...prev, parentPhone: undefined }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
                  attempted && fieldErrors.parentPhone ? "border-rose-500 ring-1 ring-rose-200" : "border-[#CED0D4]"
                }`}
                placeholder="08123456789 (10-15 digit)"
              />
              <FormFieldFeedback error={attempted ? fieldErrors.parentPhone : undefined} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Email Orang Tua</label>
              <input
                type="email"
                value={parentEmail}
                onChange={(e) => {
                  setParentEmail(e.target.value);
                  if (attempted) setFieldErrors((prev) => ({ ...prev, parentEmail: undefined }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
                  attempted && fieldErrors.parentEmail ? "border-rose-500 ring-1 ring-rose-200" : "border-[#CED0D4]"
                }`}
                placeholder="nama@domain.com"
              />
              <FormFieldFeedback error={attempted ? fieldErrors.parentEmail : undefined} />
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
