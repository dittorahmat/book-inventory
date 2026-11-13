import { useState } from "react";
import { Search, UserCheck, UserPlus, Settings2 } from "lucide-react";
import { PORTAL_STUDENT_SEARCH_INPUT_ID } from "./usePublicOrder";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { NewStudentRegistrationForm } from "./NewStudentRegistrationForm";
import { StudentCurriculumOverrideModal } from "./StudentCurriculumOverrideModal";
import { curriculumLabel } from "../../lib/curriculum";
import {
  validateRequiredSelect,
  validateRequiredText,
} from "../../lib/form-validation";
import type {
  SchoolOption,
  StudentSearchResult,
  NewStudentForm,
} from "../../lib/portal-types";

interface StudentSearchStepProps {
  schools: SchoolOption[];
  searchSchoolId: string;
  setSearchSchoolId: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isSearching: boolean;
  searchResults: StudentSearchResult[];
  onUpdateStudent?: (updated: StudentSearchResult) => void;
  isNewStudentMode: boolean;
  setIsNewStudentMode: (val: boolean) => void;
  newStudent: NewStudentForm;
  setNewStudent: React.Dispatch<React.SetStateAction<NewStudentForm>>;
  isSubmitting: boolean;
  onSearch: (e: React.FormEvent) => void;
  onSelectStudent: (st: StudentSearchResult) => void;
  onRegister: (e: React.FormEvent) => void;
}

export function StudentSearchStep({
  schools,
  searchSchoolId,
  setSearchSchoolId,
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  onUpdateStudent,
  isNewStudentMode,
  setIsNewStudentMode,
  newStudent,
  setNewStudent,
  isSubmitting,
  onSearch,
  onSelectStudent,
  onRegister,
}: StudentSearchStepProps) {
  const [editingStudent, setEditingStudent] = useState<StudentSearchResult | null>(null);
  const [searchErrors, setSearchErrors] = useState<{ schoolId?: string; query?: string }>({});
  const [searchAttempted, setSearchAttempted] = useState(false);

  const [registerErrors, setRegisterErrors] = useState<Record<string, string | undefined>>({});
  const [registerAttempted, setRegisterAttempted] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchAttempted(true);
    const errors: { schoolId?: string; query?: string } = {};

    const schoolCheck = validateRequiredSelect(searchSchoolId, "Sekolah / Unit Cabang");
    if (!schoolCheck.valid) errors.schoolId = schoolCheck.message;

    const queryCheck = validateRequiredText(searchQuery, "NIS atau Nama Siswa", 2);
    if (!queryCheck.valid) errors.query = queryCheck.message;

    setSearchErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSearch(e);
  };
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-6">
      {!isNewStudentMode ? (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wider">Cari Murid</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#050505]">
            Masukkan NIS atau Nama Lengkap / Panggilan Murid
          </h2>
          <p className="text-xs text-[#65676B] mt-1 leading-relaxed">
            Ketik nama (misal: "Hendra" atau "Wahyudi") atau NIS siswa untuk memuat data kelas secara otomatis.
          </p>

          <form onSubmit={handleSearchSubmit} noValidate className="mt-4 space-y-3">
            <FormSummaryAlert errors={searchAttempted ? searchErrors : {}} title="Pencarian Belum Lengkap" />
            <div>
              <SearchableSingleSelect
                id="portal-student-search-school"
                label="Sekolah / Unit Cabang"
                options={schools.map((s) => ({ value: s.id, label: s.name, hint: s.code }))}
                value={searchSchoolId}
                onChange={(val) => {
                  setSearchSchoolId(val);
                  if (searchAttempted) {
                    setSearchErrors((prev) => ({ ...prev, schoolId: undefined }));
                  }
                }}
                placeholder="Pilih sekolah murid..."
                required
                error={searchAttempted ? searchErrors.schoolId : undefined}
              />
            </div>
            <div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
                  <input
                    type="text"
                    id={PORTAL_STUDENT_SEARCH_INPUT_ID}
                    placeholder="Ketik NIS atau potongan nama siswa..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (searchAttempted) {
                        setSearchErrors((prev) => ({ ...prev, query: undefined }));
                      }
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 bg-[#F0F2F5] border rounded-xl text-xs sm:text-sm text-[#050505] transition-colors focus:bg-white ${
                      searchAttempted && searchErrors.query
                        ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-200"
                        : "border-transparent focus:border-[#1877F2]"
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all shrink-0 disabled:opacity-50"
                >
                  {isSearching ? "Mencari..." : "Cari Data"}
                </button>
              </div>
              <FormFieldFeedback error={searchAttempted ? searchErrors.query : undefined} />
            </div>
          </form>

          {/* Search Results - Kelas + Kurikulum sebagai info utama */}
          {searchResults.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <div className="text-xs font-semibold text-[#65676B]">
                Ditemukan {searchResults.length} murid:
              </div>
              <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-xl overflow-hidden">
                {searchResults.map((st) => (
                  <div
                    key={st.id}
                    className="p-3.5 hover:bg-[#F7F8FA] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#050505] truncate">{st.name}</span>
                        <span className="text-[11px] font-mono text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-md">
                          NIS: {st.nis}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {st.canOrder === false ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Menunggu verifikasi
                          </span>
                        ) : st.detectedStatus === "naik_kelas" ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Kelas {st.currentGradeLevel} &rarr; Naik ke Kelas {st.targetGradeLevel}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Kelas {st.targetGradeLevel}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[#050505] bg-[#F0F2F5] px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {curriculumLabel(st.curriculumType)}
                        </span>
                        {st.rombel && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {st.rombel}
                          </span>
                        )}
                        {st.stream && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {st.stream}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#65676B] mt-1 flex items-center gap-2 flex-wrap">
                        <span>{st.schoolName}</span>
                        {st.parentName && (
                          <>
                            <span>&bull;</span>
                            <span>Ortu: {st.parentName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingStudent(st)}
                        title="Ubah program belajar murid"
                        className="px-2.5 py-1.5 bg-[#F0F2F5] hover:bg-[#E4E6EB] active:scale-[0.98] text-[#050505] font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-[#65676B]" />
                        <span className="hidden sm:inline">Ubah Program</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectStudent(st)}
                        disabled={st.canOrder === false}
                        title={st.canOrder === false ? st.orderBlockedReason ?? undefined : undefined}
                        className="px-3.5 py-1.5 bg-[#E7F3FF] hover:bg-[#D8ECFF] active:scale-[0.98] text-[#1877F2] font-semibold text-xs rounded-lg transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Pilih</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt to register new student - Flat border styling */}
          <div className="mt-6 pt-5 border-t border-[#E4E6EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[#050505]">Murid Baru atau Data Tidak Ditemukan?</h4>
              <p className="text-xs text-[#65676B] mt-0.5">
                Jika putra/putri Anda adalah murid baru, isi formulir registrasi mandiri.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewStudentMode(true)}
              className="px-4 py-2 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] text-[#050505] text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1.5 shadow-2xs"
            >
              <UserPlus className="w-4 h-4 text-[#1877F2]" />
              <span>Daftar Murid Baru</span>
            </button>
          </div>
        </div>
      ) : (
        /* NEW STUDENT FORM */
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E6EB]">
            <div>
              <span className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wider">Formulir Murid Baru</span>
              <h2 className="text-base font-bold text-[#050505]">Pendaftaran Data Murid Baru</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsNewStudentMode(false)}
              className="text-xs text-[#1877F2] hover:underline font-semibold"
            >
              &larr; Kembali ke Pencarian
            </button>
          </div>

          <NewStudentRegistrationForm
            schools={schools}
            newStudent={newStudent}
            setNewStudent={setNewStudent}
            isSubmitting={isSubmitting}
            onRegister={onRegister}
            registerAttempted={registerAttempted}
            setRegisterAttempted={setRegisterAttempted}
            registerErrors={registerErrors}
            setRegisterErrors={setRegisterErrors}
          />
        </div>
      )}

      {editingStudent && (
        <StudentCurriculumOverrideModal
          student={editingStudent}
          isOpen={!!editingStudent}
          onClose={() => setEditingStudent(null)}
          onUpdated={(updated) => {
            if (onUpdateStudent) {
              onUpdateStudent(updated);
            }
            setEditingStudent(null);
          }}
        />
      )}
    </div>
  );
}
