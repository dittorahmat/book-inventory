import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import {
  validateEmail,
  validatePhone,
  validateRequiredSelect,
  validateRequiredText,
} from "../../lib/form-validation";
import type { NewStudentForm, SchoolOption } from "../../lib/portal-types";

interface NewStudentRegistrationFormProps {
  schools: SchoolOption[];
  newStudent: NewStudentForm;
  setNewStudent: React.Dispatch<React.SetStateAction<NewStudentForm>>;
  isSubmitting: boolean;
  onRegister: (e: React.FormEvent) => void;
  registerAttempted: boolean;
  setRegisterAttempted: (val: boolean) => void;
  registerErrors: Record<string, string | undefined>;
  setRegisterErrors: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>;
}

export function NewStudentRegistrationForm({
  schools,
  newStudent,
  setNewStudent,
  isSubmitting,
  onRegister,
  registerAttempted,
  setRegisterAttempted,
  registerErrors,
  setRegisterErrors,
}: NewStudentRegistrationFormProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const parentNameInputRef = useRef<HTMLInputElement>(null);
  const parentEmailInputRef = useRef<HTMLInputElement>(null);
  const parentPhoneInputRef = useRef<HTMLInputElement>(null);

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterAttempted(true);
    const errors: Record<string, string | undefined> = {};

    const schoolCheck = validateRequiredSelect(newStudent.schoolId, "Sekolah / Unit Cabang");
    if (!schoolCheck.valid) errors.schoolId = schoolCheck.message;

    const nameCheck = validateRequiredText(newStudent.name, "Nama Lengkap Murid", 2);
    if (!nameCheck.valid) errors.name = nameCheck.message;

    const gradeCheck = validateRequiredSelect(newStudent.gradeLevel, "Tingkat Kelas Masuk");
    if (!gradeCheck.valid) errors.gradeLevel = gradeCheck.message;

    const curriculumCheck = validateRequiredSelect(newStudent.curriculumType, "Pilihan Kurikulum");
    if (!curriculumCheck.valid) errors.curriculumType = curriculumCheck.message;

    const parentNameCheck = validateRequiredText(newStudent.parentName, "Nama Orang Tua / Wali", 2);
    if (!parentNameCheck.valid) errors.parentName = parentNameCheck.message;

    const emailCheck = validateEmail(newStudent.parentEmail, true);
    if (!emailCheck.valid) errors.parentEmail = emailCheck.message;

    const phoneCheck = validatePhone(newStudent.parentPhone);
    if (!phoneCheck.valid) errors.parentPhone = phoneCheck.message;

    setRegisterErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.name) nameInputRef.current?.focus();
      else if (errors.parentName) parentNameInputRef.current?.focus();
      else if (errors.parentEmail) parentEmailInputRef.current?.focus();
      else if (errors.parentPhone) parentPhoneInputRef.current?.focus();
      return;
    }

    onRegister(e);
  };

  return (
    <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
      <FormSummaryAlert errors={registerAttempted ? registerErrors : {}} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <SearchableSingleSelect
            label="Sekolah / Unit Cabang"
            options={schools.map((s) => ({ value: s.id, label: s.name, hint: s.code }))}
            value={newStudent.schoolId}
            onChange={(v) => {
              setNewStudent({ ...newStudent, schoolId: v });
              if (registerAttempted) {
                setRegisterErrors((prev) => ({ ...prev, schoolId: undefined }));
              }
            }}
            placeholder="Pilih sekolah..."
            required
            error={registerAttempted ? registerErrors.schoolId : undefined}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Nama Lengkap Murid <span className="text-rose-600">*</span>
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={newStudent.name}
            onChange={(e) => {
              setNewStudent({ ...newStudent, name: e.target.value });
              if (registerAttempted) {
                setRegisterErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            className={`w-full px-3 py-2.5 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
              registerAttempted && registerErrors.name
                ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                : "border-[#CED0D4] focus:border-[#1877F2]"
            }`}
            placeholder="Contoh: Muhammad Ali"
          />
          <FormFieldFeedback error={registerAttempted ? registerErrors.name : undefined} />
        </div>

        <div>
          <SearchableSingleSelect
            label="Tingkat Kelas Masuk"
            options={[
              { value: "1", label: "Kelas 1 SD" },
              { value: "2", label: "Kelas 2 SD" },
              { value: "3", label: "Kelas 3 SD" },
              { value: "4", label: "Kelas 4 SD" },
              { value: "5", label: "Kelas 5 SD" },
              { value: "6", label: "Kelas 6 SD" },
              { value: "7", label: "Kelas 7 SMP" },
              { value: "8", label: "Kelas 8 SMP" },
              { value: "9", label: "Kelas 9 SMP" },
              { value: "10", label: "Kelas 10 SMA" },
              { value: "11", label: "Kelas 11 SMA" },
              { value: "12", label: "Kelas 12 SMA" },
            ]}
            value={newStudent.gradeLevel}
            onChange={(v) => {
              setNewStudent({ ...newStudent, gradeLevel: v });
              if (registerAttempted) {
                setRegisterErrors((prev) => ({ ...prev, gradeLevel: undefined }));
              }
            }}
            placeholder="Pilih kelas..."
            required
            error={registerAttempted ? registerErrors.gradeLevel : undefined}
          />
        </div>

        <div>
          <SearchableSingleSelect
            label="Pilihan Kurikulum"
            options={[
              { value: "international", label: "Internasional (Cambridge)" },
              { value: "national", label: "Nasional" },
            ]}
            value={newStudent.curriculumType}
            onChange={(v) => {
              setNewStudent({ ...newStudent, curriculumType: v as NewStudentForm["curriculumType"] });
              if (registerAttempted) {
                setRegisterErrors((prev) => ({ ...prev, curriculumType: undefined }));
              }
            }}
            placeholder="Pilih kurikulum..."
            required
            error={registerAttempted ? registerErrors.curriculumType : undefined}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Nama Orang Tua / Wali <span className="text-rose-600">*</span>
          </label>
          <input
            ref={parentNameInputRef}
            type="text"
            value={newStudent.parentName}
            onChange={(e) => {
              setNewStudent({ ...newStudent, parentName: e.target.value });
              if (registerAttempted) {
                setRegisterErrors((prev) => ({ ...prev, parentName: undefined }));
              }
            }}
            className={`w-full px-3 py-2.5 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
              registerAttempted && registerErrors.parentName
                ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                : "border-[#CED0D4] focus:border-[#1877F2]"
            }`}
            placeholder="Nama orang tua/wali"
          />
          <FormFieldFeedback error={registerAttempted ? registerErrors.parentName : undefined} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Email Orang Tua <span className="text-rose-600">*</span>
          </label>
          <input
            ref={parentEmailInputRef}
            type="email"
            value={newStudent.parentEmail}
            onChange={(e) => {
              setNewStudent({ ...newStudent, parentEmail: e.target.value });
              if (registerAttempted) {
                setRegisterErrors((prev) => ({ ...prev, parentEmail: undefined }));
              }
            }}
            className={`w-full px-3 py-2.5 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
              registerAttempted && registerErrors.parentEmail
                ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                : "border-[#CED0D4] focus:border-[#1877F2]"
            }`}
            placeholder="orangtua@example.com"
          />
          <FormFieldFeedback error={registerAttempted ? registerErrors.parentEmail : undefined} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            No. WhatsApp / HP <span className="text-rose-600">*</span>
          </label>
          <input
            ref={parentPhoneInputRef}
            type="tel"
            value={newStudent.parentPhone}
            onChange={(e) => {
              setNewStudent({ ...newStudent, parentPhone: e.target.value });
              if (registerAttempted) {
                setRegisterErrors((prev) => ({ ...prev, parentPhone: undefined }));
              }
            }}
            className={`w-full px-3 py-2.5 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
              registerAttempted && registerErrors.parentPhone
                ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                : "border-[#CED0D4] focus:border-[#1877F2]"
            }`}
            placeholder="Contoh: 08123456789 (10-15 digit)"
          />
          <FormFieldFeedback
            error={registerAttempted ? registerErrors.parentPhone : undefined}
            hint="Pastikan nomor aktif di WhatsApp untuk menerima notifikasi status pesanan."
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <span>{isSubmitting ? "Menyimpan..." : "Lanjutkan Pilih Paket"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
