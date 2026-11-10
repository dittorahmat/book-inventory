import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { BookPriceFields } from "./BookPriceFields";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { getJson } from "../../lib/api";
import { SearchableMultiSelect } from "../ui/SearchableMultiSelect";
import type { Book } from "../../types";
import type { NewBookPayload } from "./catalog-intent";

interface EditBookModalProps {
  book: Book;
  onClose: () => void;
  onSave: (bookId: string, payload: Partial<NewBookPayload>) => Promise<void>;
}

export function EditBookModal({ book, onClose, onSave }: EditBookModalProps) {
  const [formData, setFormData] = useState({
    isbn: book.isbn || "",
    title: book.title || "",
    publicTitle: book.publicTitle || "",
    supplierIds: book.supplierIds || [],
    packageIds: book.packages ? book.packages.map((p) => p.packageId) : [],
    author: book.author || "",
    publisher: book.publisher || "",
    publishYear: book.publishYear || 2024,
    category: book.category || "General",
    price: book.price || 0,
    buyPrice: book.buyPrice || 0,
    sellPrice: book.sellPrice || 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<Array<{ value: string; label: string; hint?: string }>>([]);
  const [packageOptions, setPackageOptions] = useState<Array<{ value: string; label: string; hint?: string }>>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getJson<Array<{ id: string; name: string; code: string }>>(
          "/api/procurement/suppliers",
          "Gagal memuat daftar supplier."
        );
        if (!cancelled) setSupplierOptions(list.map((s) => ({ value: s.id, label: s.name, hint: s.code })));
      } catch {
        // supplier fallback
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
      } catch {
        // package fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.title.trim()) {
      setFormError("Judul buku wajib diisi.");
      return;
    }
    setIsSubmitting(true);
    try {
      const buyPrice = Math.max(0, Number(formData.buyPrice) || 0);
      const sellPrice = Math.max(0, Number(formData.sellPrice) || 0);
      const legacyPrice = effectiveSellPrice({ price: formData.price, buyPrice, sellPrice });

      await onSave(book.id, {
        isbn: formData.isbn.trim(),
        title: formData.title.trim(),
        publicTitle: formData.publicTitle.trim() || undefined,
        supplierIds: formData.supplierIds,
        packageIds: formData.packageIds,
        author: formData.author.trim(),
        publisher: formData.publisher.trim(),
        publishYear: Number(formData.publishYear) || 2024,
        category: formData.category.trim(),
        price: legacyPrice,
        buyPrice,
        sellPrice,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan perubahan buku.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]";
  const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E6EB] sticky top-0 bg-white z-10">
          <span className="text-sm font-bold text-[#050505]">Ubah Data Katalog Buku</span>
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
              <label className={labelCls}>Judul Buku Lengkap</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={inputCls}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Judul Publik (Samaran Wali Murid)</label>
              <input
                type="text"
                value={formData.publicTitle}
                onChange={(e) => setFormData({ ...formData, publicTitle: e.target.value })}
                placeholder="Contoh: Buku Paket Matematika (tanpa penerbit/nama asli)"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>ISBN / Kode Unik</label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Kategori / Jenjang</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Penulis</label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Penerbit</label>
              <input
                type="text"
                value={formData.publisher}
                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <SearchableMultiSelect
                label="Pemasok / Supplier"
                options={supplierOptions}
                values={formData.supplierIds}
                onChange={(supplierIds) => setFormData({ ...formData, supplierIds })}
                placeholder="Pilih supplier penyedia buku..."
              />
            </div>

            <div className="sm:col-span-2">
              <SearchableMultiSelect
                label="Paket Buku / Jenjang Kelas"
                options={packageOptions}
                values={formData.packageIds}
                onChange={(packageIds) => setFormData({ ...formData, packageIds })}
                placeholder="Pilih paket buku yang memuat buku ini..."
              />
            </div>

            <div className="sm:col-span-2">
              <BookPriceFields
                price={formData.price}
                buyPrice={formData.buyPrice}
                sellPrice={formData.sellPrice}
                onChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98] transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
