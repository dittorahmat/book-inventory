import { useState, useEffect } from "react";
import { 
  Search, 
  UserCheck, 
  UserPlus, 
  BookOpen, 
  CreditCard, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight
} from "lucide-react";

interface SchoolOption {
  id: string;
  name: string;
  code: string;
}

interface StudentSearchResult {
  id: string;
  nis: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  status: string;
  isScholarship: boolean;
  schoolId: string;
  schoolName: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  detectedStatus: "naik_kelas" | "aktif" | "baru";
  currentGradeLevel: string;
  targetGradeLevel: string;
}

interface BookPackageOption {
  id: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  price: number;
  totalItemsCount: number;
  items: Array<{
    title: string;
    quantity: number;
  }>;
}

export function PublicOrderView() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [packages, setPackages] = useState<BookPackageOption[]>([]);

  // Step wizard: 1 = Student Selection, 2 = Package Selection, 3 = Payment / Scholarship, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [isNewStudentMode, setIsNewStudentMode] = useState(false);

  // New Student form
  const [newStudent, setNewStudent] = useState({
    schoolId: "",
    name: "",
    gender: "male" as "male" | "female",
    gradeLevel: "1",
    curriculumType: "international" as "international" | "national",
    academicYear: "2026/2027",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
  });

  // Package & Order State
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [orderType, setOrderType] = useState<"regular" | "scholarship">("regular");
  const [scholarshipProofBase64, setScholarshipProofBase64] = useState<string>("");

  // Payment details (Regular)
  const [paymentChoice, setPaymentChoice] = useState<"full" | "partial">("full");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [bookAllocationAmount, setBookAllocationAmount] = useState<number>(0);
  const [bankName, setBankName] = useState("BCA");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentProofBase64, setPaymentProofBase64] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<any>(null);

  // Load schools & packages on mount
  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSchools(data.data);
          if (data.data.length > 0) {
            setNewStudent((prev) => ({ ...prev, schoolId: data.data[0].id }));
          }
        }
      });

    fetch("/api/packages")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPackages(data.data);
        }
      });
  }, []);

  // Search student
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/public/orders/search-students?query=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data);
        if (data.data.length === 0) {
          setIsNewStudentMode(true);
          setNewStudent((prev) => ({ ...prev, name: searchQuery.trim() }));
        } else {
          setIsNewStudentMode(false);
        }
      }
    } catch {
      setErrorMessage("Gagal melakukan pencarian siswa. Silakan coba lagi.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStudent = (st: StudentSearchResult) => {
    setSelectedStudent(st);
    setIsNewStudentMode(false);

    // Auto-select package matching target grade level
    const matched = packages.find(
      (p) => p.gradeLevel === st.targetGradeLevel && p.curriculumType === st.curriculumType
    );
    if (matched) {
      setSelectedPackageId(matched.id);
      setTransferAmount(matched.price);
      setBookAllocationAmount(matched.price);
    }
    setStep(2);
  };

  const handleRegisterNewStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/public/orders/register-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStudent),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mendaftarkan siswa baru");
      }

      const registered: StudentSearchResult = {
        id: data.data.id,
        nis: data.data.nis,
        name: data.data.name,
        gradeLevel: data.data.gradeLevel,
        curriculumType: data.data.curriculumType,
        academicYear: data.data.academicYear,
        status: data.data.status,
        isScholarship: false,
        schoolId: data.data.schoolId,
        schoolName: schools.find((s) => s.id === data.data.schoolId)?.name || "",
        parentName: data.data.parentName,
        parentEmail: data.data.parentEmail,
        parentPhone: data.data.parentPhone,
        detectedStatus: "baru",
        currentGradeLevel: data.data.gradeLevel,
        targetGradeLevel: data.data.gradeLevel,
      };

      setSelectedStudent(registered);
      // Auto select package for this new student's grade
      const matched = packages.find(
        (p) => p.gradeLevel === registered.gradeLevel && p.curriculumType === registered.curriculumType
      );
      if (matched) {
        setSelectedPackageId(matched.id);
        setTransferAmount(matched.price);
        setBookAllocationAmount(matched.price);
      }
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan pendaftaran");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const handleSubmitFinalOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedPackage) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        studentId: selectedStudent.id,
        packageId: selectedPackage.id,
        orderType,
        notes: notes.trim() || undefined,
      };

      if (orderType === "scholarship") {
        if (!scholarshipProofBase64) {
          throw new Error("Dokumen bukti surat tanda beasiswa wajib dilampirkan.");
        }
        payload.scholarshipProofBase64 = scholarshipProofBase64;
      } else {
        if (bookAllocationAmount > 0) {
          payload.payment = {
            transferAmount: transferAmount || bookAllocationAmount,
            bookAllocationAmount,
            bankName,
            referenceNumber: referenceNumber || undefined,
            paymentProofBase64: paymentProofBase64 || undefined,
          };
        }
      }

      const res = await fetch("/api/public/orders/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memproses pesanan buku");
      }

      setSubmittedOrder(data.data);
      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kendala saat mengirimkan pemesanan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Editorial Public Crest / Topbar */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1877F2] text-white shadow-sm mb-3">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#050505]">
          Formulir Pemesanan Paket Buku
        </h1>
        <p className="text-xs text-[#65676B] mt-1 max-w-md mx-auto">
          Layanan mandiri pemesanan buku sekolah Al Wildan untuk murid baru, kenaikan kelas, dan pengajuan beasiswa.
        </p>

        {/* Multi-step Breadcrumb */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            step === 1 ? "bg-[#1877F2] text-white" : "bg-[#E4E6EB] text-[#65676B]"
          }`}>
            <span>1</span> Identitas Siswa
          </div>
          <div className="w-4 h-px bg-[#CED0D4]" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            step === 2 ? "bg-[#1877F2] text-white" : "bg-[#E4E6EB] text-[#65676B]"
          }`}>
            <span>2</span> Pilih Paket
          </div>
          <div className="w-4 h-px bg-[#CED0D4]" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            step === 3 ? "bg-[#1877F2] text-white" : "bg-[#E4E6EB] text-[#65676B]"
          }`}>
            <span>3</span> Pembayaran & Beasiswa
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Perhatian</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* STEP 1: PENCARIAN SISWA ATAU PENDAFTARAN SISWA BARU */}
      {step === 1 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E4E6EB] shadow-xs space-y-6">
          {!isNewStudentMode ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Cari Murid</span>
              </div>
              <h2 className="text-lg font-bold text-[#050505]">
                Masukkan NIS atau Nama Lengkap / Panggilan Murid
              </h2>
              <p className="text-xs text-[#65676B] mt-1">
                Ketik nama (misal: "Hendra" atau "Wahyudi") atau NIS siswa untuk memuat data kelas secara otomatis.
              </p>

              <form onSubmit={handleSearch} className="mt-4 flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
                  <input
                    type="text"
                    required
                    placeholder="Ketik NIS atau potongan nama siswa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-2xl text-xs sm:text-sm text-[#050505] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-2xl text-xs sm:text-sm font-semibold shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  {isSearching ? "Mencari..." : "Cari Data"}
                </button>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="text-xs font-semibold text-[#65676B]">
                    Ditemukan {searchResults.length} murid:
                  </div>
                  <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-2xl overflow-hidden">
                    {searchResults.map((st) => (
                      <div
                        key={st.id}
                        className="p-4 hover:bg-[#F7F8FA] transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#050505] truncate">{st.name}</span>
                            <span className="text-[11px] font-mono text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-md">
                              NIS: {st.nis}
                            </span>
                            {st.detectedStatus === "naik_kelas" && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Naik ke Kelas {st.targetGradeLevel}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#65676B] mt-1 flex items-center gap-2 flex-wrap">
                            <span>{st.schoolName}</span>
                            <span>&bull;</span>
                            <span>Kurikulum: {st.curriculumType}</span>
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
                          onClick={() => handleSelectStudent(st)}
                          className="px-4 py-2 bg-[#E7F3FF] hover:bg-[#D8ECFF] text-[#1877F2] font-semibold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Pilih</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt to register new student */}
              <div className="mt-8 pt-6 border-t border-[#E4E6EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F8FA] p-4 rounded-2xl">
                <div>
                  <h4 className="text-xs font-bold text-[#050505]">Murid Baru atau Data Tidak Ditemukan?</h4>
                  <p className="text-xs text-[#65676B] mt-0.5">
                    Jika putra/putri Anda adalah murid baru, isi data pendaftaran mandiri berikut.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewStudentMode(true)}
                  className="px-4 py-2 bg-white border border-[#CED0D4] hover:bg-white/80 text-[#050505] text-xs font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs"
                >
                  <UserPlus className="w-4 h-4 text-[#1877F2]" />
                  <span>Daftar Murid Baru</span>
                </button>
              </div>
            </div>
          ) : (
            /* NEW STUDENT FORM */
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Formulir Murid Baru</span>
                  <h2 className="text-lg font-bold text-[#050505]">Pendaftaran Data Murid Baru</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewStudentMode(false)}
                  className="text-xs text-[#1877F2] hover:underline font-semibold"
                >
                  &larr; Kembali ke Pencarian
                </button>
              </div>

              <form onSubmit={handleRegisterNewStudent} className="space-y-4">
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
                      onChange={(e) => setNewStudent({ ...newStudent, curriculumType: e.target.value as any })}
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
                    <label className="block text-xs font-semibold text-[#050505] mb-1">Email Orang Tua (Untuk Notifikasi)</label>
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
                    <label className="block text-xs font-semibold text-[#050505] mb-1">No. WhatsApp / HP Orang Tua</label>
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
                    className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2"
                  >
                    <span>{isSubmitting ? "Menyimpan..." : "Lanjutkan Pilih Paket"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: PILIH PAKET BUKU */}
      {step === 2 && selectedStudent && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E4E6EB] shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-4">
            <div>
              <div className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Murid Terpilih</div>
              <h2 className="text-base font-bold text-[#050505]">{selectedStudent.name}</h2>
              <div className="text-xs text-[#65676B]">
                {selectedStudent.schoolName} &bull; NIS: {selectedStudent.nis} &bull; Target: Kelas {selectedStudent.targetGradeLevel}
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-[#65676B] hover:text-[#050505] font-semibold"
            >
              Ubah Murid
            </button>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#050505] mb-1">Pilih Paket Buku</h3>
            <p className="text-xs text-[#65676B] mb-4">
              Pilih paket buku yang disyaratkan untuk tahun ajaran baru.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {packages.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id;
                const isRecommended = pkg.gradeLevel === selectedStudent.targetGradeLevel;

                return (
                  <div
                    key={pkg.id}
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setTransferAmount(pkg.price);
                      setBookAllocationAmount(pkg.price);
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? "border-[#1877F2] bg-[#E7F3FF]/40 shadow-xs"
                        : "border-[#E4E6EB] hover:border-[#CED0D4] bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#050505]">{pkg.name}</span>
                        {isRecommended && (
                          <span className="text-[10px] font-bold bg-[#1877F2] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Rekomendasi
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-md">
                          {pkg.code}
                        </span>
                      </div>
                      <div className="text-xs text-[#65676B] mt-1">
                        Terdiri dari {pkg.totalItemsCount} buku &bull; {pkg.curriculumType}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-[#050505]">
                        Rp {pkg.price.toLocaleString("id-ID")}
                      </div>
                      <div className="text-[11px] text-[#1877F2] font-semibold">
                        {isSelected ? "Terpilih ✓" : "Klik untuk memilih"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[#E4E6EB] flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-2.5 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] transition-colors"
            >
              Kembali
            </button>
            <button
              type="button"
              disabled={!selectedPackageId}
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span>Lanjut ke Pembayaran</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PEMBAYARAN ATAU JALUR BEASISWA */}
      {step === 3 && selectedStudent && selectedPackage && (
        <form onSubmit={handleSubmitFinalOrder} className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E4E6EB] shadow-xs space-y-6">
          <div className="border-b border-[#E4E6EB] pb-4">
            <div className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Jalur Pendaftaran & Pembayaran</div>
            <h2 className="text-base font-bold text-[#050505]">
              Pilih Jalur: Reguler atau Beasiswa
            </h2>
            <p className="text-xs text-[#65676B] mt-0.5">
              Paket: <span className="font-semibold text-[#050505]">{selectedPackage.name}</span> (Normal: Rp {selectedPackage.price.toLocaleString("id-ID")})
            </p>
          </div>

          {/* Radio Order Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setOrderType("regular")}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                orderType === "regular"
                  ? "border-[#1877F2] bg-[#E7F3FF]/40"
                  : "border-[#E4E6EB] bg-white hover:border-[#CED0D4]"
              }`}
            >
              <CreditCard className="w-5 h-5 text-[#1877F2] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs text-[#050505]">Jalur Reguler</div>
                <div className="text-[11px] text-[#65676B] mt-0.5">
                  Pembayaran transfer bank (bisa lunas atau dicicil parsial).
                </div>
              </div>
            </div>

            <div
              onClick={() => setOrderType("scholarship")}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                orderType === "scholarship"
                  ? "border-emerald-600 bg-emerald-50/50"
                  : "border-[#E4E6EB] bg-white hover:border-[#CED0D4]"
              }`}
            >
              <Award className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs text-[#050505]">Jalur Beasiswa (Diskon 100%)</div>
                <div className="text-[11px] text-[#65676B] mt-0.5">
                  Bebas biaya 100% dengan melampirkan foto surat tanda beasiswa.
                </div>
              </div>
            </div>
          </div>

          {/* JALUR BEASISWA DETAILS */}
          {orderType === "scholarship" && (
            <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                <Award className="w-4 h-4 text-emerald-600" />
                Upload Surat Tanda Beasiswa
              </div>
              <p className="text-xs text-emerald-700">
                Total Tagihan Buku: <span className="font-bold">Rp 0 (Diskon 100%)</span>. Pihak sekolah akan memverifikasi dokumen sebelum paket buku diserahkan.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1.5">
                  Foto Surat / Kartu Beasiswa (Wajib)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => handleFileUpload(e, setScholarshipProofBase64)}
                  className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
                />
              </div>

              {scholarshipProofBase64 && (
                <div className="mt-2">
                  <span className="text-[11px] font-semibold text-emerald-800">Preview Lampiran Dokumen:</span>
                  <img
                    src={scholarshipProofBase64}
                    alt="Scholarship proof"
                    className="mt-1 h-32 rounded-xl object-contain border border-emerald-300 bg-white p-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* JALUR REGULER DETAILS */}
          {orderType === "regular" && (
            <div className="space-y-4 p-5 bg-[#F7F8FA] border border-[#E4E6EB] rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#050505]">Rencana Pembayaran</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentChoice("full");
                      setBookAllocationAmount(selectedPackage.price);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      paymentChoice === "full" ? "bg-[#1877F2] text-white" : "bg-white text-[#65676B] border border-[#CED0D4]"
                    }`}
                  >
                    Bayar Lunas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentChoice("partial");
                      setBookAllocationAmount(Math.round(selectedPackage.price / 2));
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      paymentChoice === "partial" ? "bg-[#1877F2] text-white" : "bg-white text-[#65676B] border border-[#CED0D4]"
                    }`}
                  >
                    Cicilan (Parsial)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">
                    Bank Tujuan Transfer
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                  >
                    <option value="BCA">BCA (Yayasan Al Wildan - 882019283)</option>
                    <option value="Mandiri">Mandiri (Yayasan Al Wildan - 164000293)</option>
                    <option value="BSI">BSI (Yayasan Al Wildan - 772001928)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">
                    Nomor Referensi / No. Resi Bank
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Contoh: 981249821 / Ref ATM"
                    className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">
                    Total Nominal Struk Bukti Transfer (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                    placeholder="Total di struk (bisa gabung SPP)"
                  />
                  <span className="text-[10px] text-[#65676B] block mt-0.5">
                    *Isi total transfer di struk jika Anda mentransfer gabungan (misal SPP + Buku).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">
                    Alokasi Khusus untuk Buku Ini (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={selectedPackage.price}
                    value={bookAllocationAmount}
                    onChange={(e) => setBookAllocationAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-bold text-[#1877F2]"
                  />
                  <div className="flex justify-between text-[10px] text-[#65676B] mt-0.5">
                    <span>Tagihan: Rp {selectedPackage.price.toLocaleString("id-ID")}</span>
                    <span>Sisa: Rp {Math.max(0, selectedPackage.price - bookAllocationAmount).toLocaleString("id-ID")}</span>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#050505] mb-1">
                    Foto / Screenshot Bukti Transfer
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setPaymentProofBase64)}
                    className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1877F2] file:text-white hover:file:bg-[#166FE5]"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan untuk bagian administrasi buku sekolah..."
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
          </div>

          <div className="pt-4 border-t border-[#E4E6EB] flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-2.5 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] transition-colors"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? "Mengirimkan Pesanan..." : "Konfirmasi & Kirim Pesanan"}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: SUCCESS CONFIRMATION */}
      {step === 4 && submittedOrder && (
        <div className="bg-white rounded-3xl p-8 border border-[#E4E6EB] shadow-xs text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-[#050505]">Pemesanan Buku Berhasil Didaftarkan!</h2>
          <p className="text-xs text-[#65676B] max-w-md mx-auto">
            Data pemesanan telah tersimpan di sistem sekolah. Konfirmasi dan instruksi pengambilan telah dikirimkan ke email Anda.
          </p>

          <div className="bg-[#F7F8FA] p-5 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2 border border-[#E4E6EB]">
            <div className="flex justify-between">
              <span className="text-[#65676B]">Nomor Pesanan:</span>
              <span className="font-mono font-bold text-[#050505]">{submittedOrder.order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#65676B]">Nama Murid:</span>
              <span className="font-semibold text-[#050505]">{submittedOrder.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#65676B]">Paket Buku:</span>
              <span className="font-semibold text-[#050505]">{submittedOrder.packageName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#65676B]">Status Pembayaran:</span>
              <span className="font-bold uppercase tracking-wider text-[#1877F2]">
                {submittedOrder.paymentStatus}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#E4E6EB] pt-2 font-bold">
              <span>Total Tagihan:</span>
              <span>Rp {submittedOrder.totalAmount.toLocaleString("id-ID")}</span>
            </div>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => {
                setStep(1);
                setSelectedStudent(null);
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] transition-colors"
            >
              Pesan untuk Siswa Lain
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
