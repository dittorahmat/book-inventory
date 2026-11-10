import { useState, useRef } from "react";
import { X, Check } from "lucide-react";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { validatePhone, validateRequiredSelect, validateRequiredText } from "../../lib/form-validation";
import { getAvailableCurriculaForGrade, curriculumLabel } from "../../lib/curriculum";
import { updateStudentCurriculum } from "./portal-api";
import type { StudentSearchResult } from "../../lib/portal-types";

interface StudentCurriculumOverrideModalProps {
  student: StudentSearchResult;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedStudent: StudentSearchResult) => void;
}

export function StudentCurriculumOverrideModal({
  student,
  isOpen,
  onClose,
  onUpdated,
}: StudentCurriculumOverrideModalProps) {
  const [selectedCurriculum, setSelectedCurriculum] = useState(student.curriculumType);
  const [selectedStream, setSelectedStream] = useState<string>(student.stream ?? "");
  const [parentName, setParentName] = useState(student.parentName ?? "");
  const [parentPhone, setParentPhone] = useState(student.parentPhone ?? "");
  const [approvalProofBase64, setApprovalProofBase64] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const parentNameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const effectiveGrade = student.targetGradeLevel || student.gradeLevel || "1";
  const targetGradeNum = parseInt(effectiveGrade, 10);
  const isHighSchool = !Number.isNaN(targetGradeNum) && targetGradeNum >= 10;
  const availableCurricula = getAvailableCurriculaForGrade(effectiveGrade);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setApprovalProofBase64("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setApprovalProofBase64(reader.result as string);
      if (attempted) setErrors((prev) => ({ ...prev, approvalProof: undefined }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setApiError(null);
    const newErrors: Record<string, string | undefined> = {};

    const currCheck = validateRequiredSelect(selectedCurriculum, "Pilihan Program");
    if (!currCheck.valid) newErrors.curriculum = currCheck.message;

    const nameCheck = validateRequiredText(parentName, "Nama Orang Tua / Wali", 2);
    if (!nameCheck.valid) newErrors.parentName = nameCheck.message;

    const phoneCheck = validatePhone(parentPhone);
    if (!phoneCheck.valid) newErrors.parentPhone = phoneCheck.message;

    if (!approvalProofBase64.trim()) {
      newErrors.approvalProof = "Surat persetujuan mutasi program dari sekolah wajib diunggah";
    }

    if (isHighSchool && !selectedStream) {
      newErrors.stream = "Peminatan (IPA/IPS) wajib dipilih untuk jenjang SMA";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      if (newErrors.parentName && parentNameInputRef.current) {
        parentNameInputRef.current.focus();
      } else if (newErrors.parentPhone && phoneInputRef.current) {
        phoneInputRef.current.focus();
      } else if (newErrors.approvalProof && fileInputRef.current) {
        fileInputRef.current.focus();
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateStudentCurriculum(student.id, {
        nis: student.nis,
        parentName: parentName.trim(),
        parentPhone: parentPhone.trim(),
        curriculumType: selectedCurriculum,
        stream: isHighSchool ? selectedStream || null : null,
        schoolApprovalProofBase64: approvalProofBase64,
      });
      onUpdated(res);
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Gagal menyimpan perubahan program");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-[#E4E6EB] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 sm:p-5 border-b border-[#E4E6EB] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#050505]">
              Penyesuaian Program Belajar
            </h3>
            <p className="text-xs text-[#65676B] mt-0.5">
              Pembaruan program untuk {student.name} ({student.schoolName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#65676B] hover:bg-[#F0F2F5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {attempted && Object.keys(errors).length > 0 && (
            <FormSummaryAlert
              title="Mohon lengkapi formulir"
              errors={errors}
            />
          )}

          {apiError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
              {apiError}
            </div>
          )}

          <div className="bg-[#F7F8FA] p-3 rounded-xl border border-[#E4E6EB] text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[#65676B]">Siswa / NIS:</span>
              <span className="font-semibold text-[#050505]">{student.name} ({student.nis})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#65676B]">Tingkat Kelas:</span>
              <span className="font-semibold text-[#050505]">Kelas {student.targetGradeLevel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#65676B]">Program Saat Ini:</span>
              <span className="font-semibold text-[#1877F2]">{curriculumLabel(student.curriculumType)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#050505] mb-1">
              Pilih Program Baru <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedCurriculum}
              onChange={(e) => {
                setSelectedCurriculum(e.target.value);
                if (attempted) setErrors((prev) => ({ ...prev, curriculum: undefined }));
              }}
              className={`w-full px-3 py-2 bg-[#F0F2F5] border rounded-xl text-xs sm:text-sm text-[#050505] focus:bg-white focus:outline-hidden ${
                attempted && errors.curriculum
                  ? "border-rose-500 ring-1 ring-rose-200"
                  : "border-transparent focus:border-[#1877F2]"
              }`}
            >
              {availableCurricula.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FormFieldFeedback error={attempted ? errors.curriculum : undefined} />
          </div>

          {isHighSchool && (
            <div>
              <label className="block text-xs font-bold text-[#050505] mb-1">
                Peminatan (Stream SMA) <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedStream}
                onChange={(e) => {
                  setSelectedStream(e.target.value);
                  if (attempted) setErrors((prev) => ({ ...prev, stream: undefined }));
                }}
                className={`w-full px-3 py-2 bg-[#F0F2F5] border rounded-xl text-xs sm:text-sm text-[#050505] focus:bg-white focus:outline-hidden ${
                  attempted && errors.stream
                    ? "border-rose-500 ring-1 ring-rose-200"
                    : "border-transparent focus:border-[#1877F2]"
                }`}
              >
                <option value="">-- Pilih Peminatan --</option>
                <option value="IPA">IPA (Ilmu Pengetahuan Alam)</option>
                <option value="IPS">IPS (Ilmu Pengetahuan Sosial)</option>
              </select>
              <FormFieldFeedback error={attempted ? errors.stream : undefined} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#050505] mb-1">
                Nama Orang Tua / Wali <span className="text-rose-500">*</span>
              </label>
              <input
                ref={parentNameInputRef}
                type="text"
                value={parentName}
                onChange={(e) => {
                  setParentName(e.target.value);
                  if (attempted) setErrors((prev) => ({ ...prev, parentName: undefined }));
                }}
                placeholder="Contoh: Budi Santoso"
                className={`w-full px-3 py-2 bg-[#F0F2F5] border rounded-xl text-xs sm:text-sm text-[#050505] focus:bg-white focus:outline-hidden ${
                  attempted && errors.parentName
                    ? "border-rose-500 ring-1 ring-rose-200"
                    : "border-transparent focus:border-[#1877F2]"
                }`}
              />
              <FormFieldFeedback error={attempted ? errors.parentName : undefined} />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#050505] mb-1">
                No. WhatsApp / HP <span className="text-rose-500">*</span>
              </label>
              <input
                ref={phoneInputRef}
                type="tel"
                value={parentPhone}
                onChange={(e) => {
                  setParentPhone(e.target.value);
                  if (attempted) setErrors((prev) => ({ ...prev, parentPhone: undefined }));
                }}
                placeholder="0812xxxxxxxx"
                className={`w-full px-3 py-2 bg-[#F0F2F5] border rounded-xl text-xs sm:text-sm text-[#050505] focus:bg-white focus:outline-hidden ${
                  attempted && errors.parentPhone
                    ? "border-rose-500 ring-1 ring-rose-200"
                    : "border-transparent focus:border-[#1877F2]"
                }`}
              />
              <FormFieldFeedback error={attempted ? errors.parentPhone : undefined} />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#050505] mb-1">
                Surat Persetujuan Mutasi Program dari Sekolah <span className="text-rose-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className={`w-full px-3 py-2 bg-[#F0F2F5] border rounded-xl text-xs sm:text-sm text-[#050505] focus:bg-white focus:outline-hidden ${
                  attempted && errors.approvalProof
                    ? "border-rose-500 ring-1 ring-rose-200"
                    : "border-transparent focus:border-[#1877F2]"
                }`}
              />
              <FormFieldFeedback error={attempted ? errors.approvalProof : undefined} />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#65676B] hover:bg-[#F0F2F5] rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
