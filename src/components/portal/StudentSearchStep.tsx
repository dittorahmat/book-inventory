import { Search, UserCheck, UserPlus, ArrowRight } from "lucide-react";
import type {
  SchoolOption,
  StudentSearchResult,
  NewStudentForm,
} from "../../lib/portal-types";

interface StudentSearchStepProps {
  schools: SchoolOption[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isSearching: boolean;
  searchResults: StudentSearchResult[];
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
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  isNewStudentMode,
  setIsNewStudentMode,
  newStudent,
  setNewStudent,
  isSubmitting,
  onSearch,
  onSelectStudent,
  onRegister,
}: StudentSearchStepProps) {
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

          <form onSubmit={onSearch} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
              <input
                type="text"
                required
                placeholder="Ketik NIS atau potongan nama siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-xl text-xs sm:text-sm text-[#050505] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all shrink-0 disabled:opacity-50"
            >
              {isSearching ? "Mencari..." : "Cari Data"}
            </button>
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
                        {st.detectedStatus === "naik_kelas" ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Kelas {st.currentGradeLevel} &rarr; Naik ke Kelas {st.targetGradeLevel}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Kelas {st.targetGradeLevel}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[#050505] bg-[#F0F2F5] px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {st.curriculumType === "international" ? "Internasional" : "Nasional"}
                        </span>
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

                    <button
                      type="button"
                      onClick={() => onSelectStudent(st)}
                      className="px-3.5 py-1.5 bg-[#E7F3FF] hover:bg-[#D8ECFF] active:scale-[0.98] text-[#1877F2] font-semibold text-xs rounded-lg transition-all shrink-0 flex items-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Pilih</span>
                    </button>
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

          <form onSubmit={onRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Sekolah / Unit Cabang</label>
                <select
                  value={newStudent.schoolId}
                  onChange={(e) => setNewStudent({ ...newStudent, schoolId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                  required
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Lengkap Murid</label>
                <input
                  type="text"
                  required
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                  placeholder="Contoh: Muhammad Ali"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Tingkat Kelas Masuk</label>
                <select
                  value={newStudent.gradeLevel}
                  onChange={(e) => setNewStudent({ ...newStudent, gradeLevel: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                >
                  <option value="1">Kelas 1 SD</option>
                  <option value="2">Kelas 2 SD</option>
                  <option value="7">Kelas 7 SMP</option>
                  <option value="10">Kelas 10 SMA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Pilihan Kurikulum</label>
                <select
                  value={newStudent.curriculumType}
                  onChange={(e) => setNewStudent({ ...newStudent, curriculumType: e.target.value as NewStudentForm["curriculumType"] })}
                  className="w-full px-3 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                >
                  <option value="international">Internasional (Cambridge)</option>
                  <option value="national">Nasional</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Orang Tua / Wali</label>
                <input
                  type="text"
                  required
                  value={newStudent.parentName}
                  onChange={(e) => setNewStudent({ ...newStudent, parentName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Email Orang Tua</label>
                <input
                  type="email"
                  required
                  value={newStudent.parentEmail}
                  onChange={(e) => setNewStudent({ ...newStudent, parentEmail: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                  placeholder="orangtua@example.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#050505] mb-1">No. WhatsApp / HP</label>
                <input
                  type="tel"
                  required
                  value={newStudent.parentPhone}
                  onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                  placeholder="+628123456789"
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
        </div>
      )}
    </div>
  );
}
