import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { BookPriceFields } from "./BookPriceFields";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { getJson } from "../../lib/api";
import { SearchableMultiSelect } from "../ui/SearchableMultiSelect";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { CANONICAL_CURRICULUM_OPTIONS, CANONICAL_GRADES, SEMESTER_OPTIONS } from "../../lib/curriculum";
import type { NewBookPayload } from "./catalog-intent";
import type { CurriculumType } from "../../db/schema";

interface CreateBookFormProps {
  onClose: () => void;
  onCreate: (payload: NewBookPayload, coverFile: File | null) => Promise<unknown>;
}

const emptyForm = {
  isbn: "",
  title: "",
  publicTitle: "",
  gradeLevel: "",
  curriculumType: "" as CurriculumType | "",
  semester: "all",
  supplierIds: [] as string[],
  packageIds: [] as string[],
  author: "",
  publisher: "",
  publishYear: 2024,
  category: "General",
  description: "",
  price: 0,
  buyPrice: 0,
  sellPrice: 0,
};

/** Formulir pendaftaran judul katalog + cover; harga dasar fallback kanonik. */
export function CreateBookForm({ onClose, onCreate }: CreateBookFormProps) {
  const [formData, setFormData] = useState({ ...emptyForm });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<Array<{ value: string; label: string; hint?: string }>>([]);
  const [packageOptions, setPackageOptions] = useState<Array<{ value: string; label: string; hint?: string }>>([]);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getJson<Array<{ id: string; name: string; code: string }>>(
          "/api/procurement/suppliers",
          "Gagal memuat daftar supplier."
        );
        if (!cancelled) setSupplierOptions(list.map((s) => ({ value: s.id, label: s.name, hint: s.code })));
      } catch (err) {
        if (!cancelled) setSupplierError(err instanceof Error ? err.message : "Gagal memuat daftar supplier.");
      }
      try {
        const pkgList = await getJson<Array<{ id: string; name: string; code: string; gradeLevel?: string }>>(
          "/api/packages",
          "Gagal memuat daftar paket."
        );
        if (!cancelled) {
          setPackageOptions(
            pkgList.map((p) => ({
              value: p.id,
              label: p.name,
              hint: p.gradeLevel ? `Kelas ${p.gradeLevel} (${p.code})` : p.code,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setPackageError(err instanceof Error ? err.message : "Gagal memuat daftar paket.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCoverChange = (file: File | null) => {
    setCoverFile(file);
    setCoverPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const buyPrice = Math.max(0, Number(formData.buyPrice) || 0);
      const sellPrice = Math.max(0, Number(formData.sellPrice) || 0);
      const legacyPrice = effectiveSellPrice({ price: formData.price, buyPrice, sellPrice });
      await onCreate(
        {
          ...formData,
          curriculumType: formData.curriculumType || null,
          gradeLevel: formData.gradeLevel || null,
          semester: formData.semester || null,
          price: legacyPrice,
          buyPrice,
          sellPrice,
        },
        coverFile
      );
      setFormData({ ...emptyForm });
      setCoverFile(null);
      setCoverPreviewUrl(null);
    } catch (err: unknown) {
      alert(`Gagal mendaftarkan buku: ${err instanceof Error ? err.message : "Terjadi kesalahan koneksi"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 sm:p-6 border border-[#CED0D4] bg-white rounded-2xl space-y-4 max-w-2xl shadow-xl">
      <div className="font-bold text-base text-[#050505] border-b border-[#E4E6EB] pb-3">
        Daftarkan Judul Katalog Baru
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        <div className="sm:w-36 flex flex-col items-center justify-start shrink-0">
          <label className="block text-xs font-semibold text-[#050505] mb-1.5 self-start">Cover Buku</label>
          <label
            className={`w-full aspect-[3/4] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group ${
              coverPreviewUrl
                ? "border-[#1877F2] bg-[#E7F3FF]/20"
                : "border-[#CED0D4] bg-[#F0F2F5] hover:border-[#1877F2] hover:bg-[#E7F3FF]/10"
            }`}
          >
            {coverPreviewUrl ? (
              <>
                <img
                  src={coverPreviewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
                  Ubah Cover
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center p-3 text-center">
                <Upload className="w-6 h-6 text-[#1877F2] mb-1.5" />
                <span className="text-xs font-semibold text-[#050505]">Upload Cover</span>
                <span className="text-[10px] text-[#65676B] mt-0.5">PNG, JPG to R2</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleCoverChange(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-3.5 text-xs">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Nomor ISBN / Kode Buku <span className="font-normal text-[#65676B]">(opsional)</span>
            </label>
            <input
              className="w-full font-mono border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
              placeholder="Contoh: 978-3-16-148410-0 atau kode internal (kosongkan jika otomatis)"
              value={formData.isbn}
              onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#050505] mb-1">Judul Buku</label>
            <input
              required
              className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
              placeholder="Judul lengkap buku"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#050505] mb-1">Judul Publik (alias, tampil di portal)</label>
            <input
              className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
              placeholder="Contoh: Matematika Seru Kelas 1 (kosong = pakai judul real)"
              value={formData.publicTitle}
              onChange={(e) => setFormData({ ...formData, publicTitle: e.target.value })}
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <SearchableSingleSelect
              label="Tingkat Kelas"
              options={CANONICAL_GRADES.map((g) => ({ value: g, label: `Kelas ${g}` }))}
              value={formData.gradeLevel}
              onChange={(v) => setFormData({ ...formData, gradeLevel: v })}
              placeholder="Pilih kelas..."
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <SearchableSingleSelect
              label="Program"
              options={CANONICAL_CURRICULUM_OPTIONS}
              value={formData.curriculumType}
              onChange={(v) => setFormData({ ...formData, curriculumType: v as CurriculumType })}
              placeholder="Pilih program..."
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <SearchableSingleSelect
              label="Semester"
              options={SEMESTER_OPTIONS}
              value={formData.semester}
              onChange={(v) => setFormData({ ...formData, semester: v })}
              placeholder="Pilih semester..."
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold text-[#050505] mb-1">Kategori / Mapel</label>
            <input
              className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
              placeholder="Contoh: Matematika / Bahasa Arab"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>

          <div className="col-span-2">
            <SearchableMultiSelect
              label="Masukkan ke Paket Buku Langsung"
              options={packageOptions}
              values={formData.packageIds}
              onChange={(values) => setFormData({ ...formData, packageIds: values })}
              placeholder="Pilih paket buku (opsional)..."
            />
            {packageError ? <p className="mt-1 text-[11px] text-red-600">{packageError}</p> : null}
          </div>

          <div className="col-span-2">
            <SearchableMultiSelect
              label="Supplier (kosong = semua supplier)"
              options={supplierOptions}
              values={formData.supplierIds}
              onChange={(values) => setFormData({ ...formData, supplierIds: values })}
              placeholder="Pilih supplier..."
            />
            {supplierError ? <p className="mt-1 text-[11px] text-red-600">{supplierError}</p> : null}
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#050505] mb-1">Catatan / Deskripsi Buku</label>
            <textarea
              rows={2}
              className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
              placeholder="Deskripsi singkat atau catatan pengadaan buku..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold text-[#050505] mb-1">Penulis / Author</label>
            <input
              required
              className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
              placeholder="Nama penulis"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold text-[#050505] mb-1">Penerbit / Publisher</label>
            <input
              required
              className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
              placeholder="Penerbit"
              value={formData.publisher}
              onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
            />
          </div>
          <BookPriceFields
            price={formData.price}
            buyPrice={formData.buyPrice}
            sellPrice={formData.sellPrice}
            onChange={(field, value) => setFormData({ ...formData, [field]: value })}
          />
        </div>
      </div>

      <div className="flex gap-2.5 justify-end pt-3 border-t border-[#E4E6EB]">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors active:scale-[0.98]"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm disabled:opacity-50 active:scale-[0.98]"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan Buku"}
        </button>
      </div>
    </form>
  );
}
