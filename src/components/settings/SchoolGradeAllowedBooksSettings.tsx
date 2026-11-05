import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import { getJson, postJson, delJson } from "../../lib/api";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { School, Book } from "../../types";

interface AllowedBookRow {
  id: string;
  schoolId: string;
  gradeLevel: string;
  bookId: string;
  bookTitle: string;
  bookIsbn: string;
  createdAt: string;
}

interface SchoolGradeAllowedBooksSettingsProps {
  schools: School[];
}

export function SchoolGradeAllowedBooksSettings({ schools }: SchoolGradeAllowedBooksSettingsProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState(schools[0]?.id ?? "");
  const [gradeLevel, setGradeLevel] = useState("1");
  const [allowedBooks, setAllowedBooks] = useState<AllowedBookRow[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllowed = useCallback(async () => {
    if (!selectedSchoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getJson<AllowedBookRow[]>(
        `/api/schools/${selectedSchoolId}/allowed-books?gradeLevel=${gradeLevel}`,
        "Gagal memuat daftar buku yang diizinkan."
      );
      setAllowedBooks(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat whitelist buku.");
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId, gradeLevel]);

  useEffect(() => {
    getJson<Book[]>("/api/books", "Gagal memuat katalog buku.")
      .then(setAllBooks)
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat katalog buku."));
  }, []);

  useEffect(() => {
    loadAllowed();
  }, [loadAllowed]);

  const handleAdd = async () => {
    if (!selectedSchoolId || !selectedBookId) return;
    setSaving(true);
    setError(null);
    try {
      await postJson(
        `/api/schools/${selectedSchoolId}/allowed-books`,
        { gradeLevel, bookId: selectedBookId },
        "Gagal menambahkan buku ke whitelist."
      );
      setSelectedBookId("");
      await loadAllowed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan buku.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (allowedId: string) => {
    if (!confirm("Cabut izin pembelian satuan buku ini untuk sekolah & jenjang terpilih?")) return;
    try {
      await delJson(
        `/api/schools/${selectedSchoolId}/allowed-books/${allowedId}`,
        "Gagal mencabut izin buku."
      );
      await loadAllowed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencabut izin buku.");
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-[#E4E6EB]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-[#050505]">
            Override Whitelist Satuan (Sekolah & Jenjang)
          </h4>
          <p className="text-xs text-[#65676B] mt-0.5">
            Buku tambahan yang diizinkan dibeli satuan di luar komponen paket wajib siswa.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SearchableSingleSelect
          label="Pilih Cabang Sekolah"
          options={schools.map((s) => ({ value: s.id, label: s.name }))}
          value={selectedSchoolId}
          onChange={setSelectedSchoolId}
        />
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Jenjang / Kelas</label>
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20"
          >
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((g) => (
              <option key={g} value={g}>
                Kelas {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E4E6EB] space-y-3">
        <label className="block text-xs font-bold text-[#050505]">Tambah Buku ke Whitelist:</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <SearchableSingleSelect
              label=""
              options={allBooks.map((b) => ({
                value: b.id,
                label: `${b.title} (${b.isbn})`,
              }))}
              value={selectedBookId}
              onChange={setSelectedBookId}
              placeholder="— Cari judul buku atau ISBN —"
            />
          </div>
          <button
            type="button"
            disabled={!selectedBookId || saving}
            onClick={handleAdd}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{saving ? "Menyimpan..." : "Tambah Izin"}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
        {loading ? (
          <div className="p-4 text-center text-xs text-[#65676B]">Memuat whitelist...</div>
        ) : allowedBooks.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#65676B]">
            Belum ada buku override khusus untuk cabang & kelas ini. Pembelian satuan hanya mengizinkan komponen paket siswa.
          </div>
        ) : (
          allowedBooks.map((row) => (
            <div key={row.id} className="p-3 flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-[#050505]">{row.bookTitle}</p>
                <p className="text-[11px] text-[#65676B]">ISBN: {row.bookIsbn}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(row.id)}
                className="p-1.5 text-[#65676B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Cabut izin"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
