import { useState, useEffect } from "react";
import { AlertCircle, RotateCcw, Search, CheckCircle2, Upload, Loader2 } from "lucide-react";
import { SearchableSingleSelect } from "../components/ui/SearchableSingleSelect";
import { fetchSchools, type SchoolOption } from "../components/students/students-api";
import { getJson, postJson, buildQuery } from "../lib/api";
import { formatRupiah } from "../lib/transfer-pricing";

interface StudentSearchResult {
  id: string;
  name: string;
  nis: string;
  gradeLevel: string;
  orders: Array<{
    id: string;
    orderId?: string;
    orderNumber: string;
    bookTitle: string;
    bookId: string;
    price: number;
  }>;
}

export function PublicBookReturnView() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [students, setStudents] = useState<StudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);

  const [selectedBook, setSelectedBook] = useState<{ orderId: string; bookId: string; title: string; price: number } | null>(null);
  const [reason, setReason] = useState("");
  const [photoProofUrl, setPhotoProofUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  useEffect(() => {
    fetchSchools()
      .then((res) => {
        setSchools(res);
        if (res.length > 0) setSelectedSchoolId(res[0].id);
      })
      .catch((err) => setError(err.message || "Gagal memuat daftar sekolah"));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId || !searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const data = await getJson<StudentSearchResult[]>(
        buildQuery("/api/public/orders/students", {
          schoolId: selectedSchoolId,
          query: searchQuery.trim(),
        }),
        "Gagal mencari siswa"
      );
      setStudents(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mencari siswa");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !selectedStudent || !reason.trim()) {
      setError("Pilih buku dan masukkan alasan pengembalian/refund.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await postJson<{ id: string }>(
        "/api/student-orders/returns",
        {
          orderId: selectedBook.orderId,
          studentId: selectedStudent.id,
          defectiveBookId: selectedBook.bookId,
          reason: reason.trim(),
          photoProofUrl: photoProofUrl.trim() || undefined,
        },
        "Gagal mengirimkan pengajuan refund buku."
      );
      setSuccessCode(res.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengirimkan pengajuan refund.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-3">
          <RotateCcw className="w-4 h-4" />
          <span>Pengembalian & Refund Buku</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#050505]">Pengajuan Refund Buku ke Logistik</h1>
        <p className="text-xs text-[#65676B] mt-1 max-w-md mx-auto">
          Cari data siswa berdasarkan cabang dan NIS/Nama, pilih buku yang dikembalikan, lalu unggah bukti kondisi fisik buku.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Perhatian</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {successCode ? (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#050505]">Pengajuan Refund Berhasil Dikirim</h2>
          <p className="text-xs text-[#65676B] max-w-md mx-auto">
            Nomor referensi laporan refund Anda: <span className="font-mono font-bold text-[#050505]">{successCode}</span>.
            Tim logistik gudang akan memeriksa kondisi fisik buku untuk verifikasi approval pengembalian dana.
          </p>
          <button
            type="button"
            onClick={() => {
              setSuccessCode(null);
              setSelectedStudent(null);
              setSelectedBook(null);
              setReason("");
              setPhotoProofUrl("");
            }}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5]"
          >
            Ajukan Pengembalian Lain
          </button>
        </div>
      ) : !selectedStudent ? (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 shadow-xs space-y-4">
          <div>
            <SearchableSingleSelect
              label="Cabang / Sekolah"
              options={schools.map((s) => ({ value: s.id, label: s.name }))}
              value={selectedSchoolId}
              onChange={setSelectedSchoolId}
              placeholder="Pilih cabang..."
            />
          </div>

          <form onSubmit={handleSearch} className="space-y-3">
            <label className="block text-xs font-semibold text-[#050505]">Cari NIS atau Nama Siswa</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik minimal 2 karakter..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] flex items-center gap-1.5 shrink-0"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Cari</span>
              </button>
            </div>
          </form>

          {students.length > 0 && (
            <div className="pt-2 divide-y divide-[#E4E6EB]">
              <div className="text-[11px] font-bold text-[#65676B] pb-2">HASIL PENCARIAN SISWA</div>
              {students.map((st) => (
                <div key={st.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[#050505]">{st.name}</div>
                    <div className="text-[11px] text-[#65676B]">NIS {st.nis} &bull; Kelas {st.gradeLevel}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(st)}
                    className="px-3 py-1.5 bg-[#E7F3FF] text-[#1877F2] hover:bg-[#1877F2] hover:text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Pilih Siswa
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E4E6EB] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E6EB]">
            <div>
              <div className="text-xs font-bold text-[#050505]">{selectedStudent.name}</div>
              <div className="text-[11px] text-[#65676B]">NIS {selectedStudent.nis} &bull; Kelas {selectedStudent.gradeLevel}</div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStudent(null)}
              className="text-xs text-[#1877F2] hover:underline"
            >
              Ganti Siswa
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-2">Pilih Buku yang Ingin Di-Refund</label>
            {selectedStudent.orders && selectedStudent.orders.length > 0 ? (
              <div className="space-y-2">
                {selectedStudent.orders.map((ord) => {
                  const effectiveOrderId = ord.orderId || ord.id;
                  return (
                    <label
                      key={`${effectiveOrderId}-${ord.bookId}`}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                        selectedBook?.bookId === ord.bookId
                          ? "border-[#1877F2] bg-[#E7F3FF]/40 text-[#050505]"
                          : "border-[#E4E6EB] hover:bg-[#F0F2F5]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="selectedBook"
                          checked={selectedBook?.bookId === ord.bookId}
                          onChange={() =>
                            setSelectedBook({
                              orderId: effectiveOrderId,
                              bookId: ord.bookId,
                              title: ord.bookTitle,
                              price: ord.price,
                            })
                          }
                          className="text-[#1877F2]"
                        />
                        <span className="font-semibold">{ord.bookTitle}</span>
                      </div>
                      <span className="font-bold text-emerald-700">{formatRupiah(ord.price || 0)}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-xs">
                Belum ada catatan penyerahan buku paket pada murid ini, atau masukkan judul buku manual pada alasan.
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Alasan Pengembalian / Refund</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan buku dikembalikan (misal: halaman cacat/rusak/pindah sekolah)..."
              className="w-full p-3 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">URL Foto Fisik Buku (Bukti Kondisi)</label>
            <input
              type="url"
              value={photoProofUrl}
              onChange={(e) => setPhotoProofUrl(e.target.value)}
              placeholder="https://... atau link upload foto buku"
              className="w-full p-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedStudent(null)}
              className="px-4 py-2 border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Kirim Pengajuan Refund</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
