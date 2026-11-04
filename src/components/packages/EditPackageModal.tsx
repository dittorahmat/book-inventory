import { useState } from "react";
import { AlertTriangle, Package, Plus, Trash2, X } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { Book } from "../../types";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { formatRupiah } from "../../lib/transfer-pricing";
import { WPR_BOOK_ID, WPR_PRICE } from "../../lib/wpr";
import type { NewPackagePayload, PackageRow } from "./usePackagesData";

interface PackageItemInput {
  bookId: string;
  quantity: number;
}

interface EditPackageModalProps {
  pkg: PackageRow;
  readyBundleCount: number;
  catalogBooks: Book[];
  updatePackage: (packageId: string, payload: NewPackagePayload) => Promise<void>;
  onClose: () => void;
  onUpdated: () => void;
}

/** Modal edit master paket buku: metadata + komposisi BOM + kalkulasi harga + guard auto-unbundle. */
export function EditPackageModal({
  pkg,
  readyBundleCount,
  catalogBooks,
  updatePackage,
  onClose,
  onUpdated,
}: EditPackageModalProps) {
  const [gradeLevel, setGradeLevel] = useState(pkg.gradeLevel);
  const [curriculumType, setCurriculumType] = useState<"international" | "national">(pkg.curriculumType);
  const [code, setCode] = useState(pkg.code);
  const [name, setName] = useState(pkg.name);
  const [academicYear, setAcademicYear] = useState(pkg.academicYear);
  const [description, setDescription] = useState(pkg.description || "");

  // Inisialisasi item BOM tanpa baris WPR (karena WPR otomatis di backend)
  const [items, setItems] = useState<PackageItemInput[]>(() => {
    const rawItems = (pkg.items || [])
      .filter((it) => it.bookId !== WPR_BOOK_ID)
      .map((it) => ({ bookId: it.bookId, quantity: it.quantity }));
    if (rawItems.length > 0) return rawItems;
    return catalogBooks.length > 0 ? [{ bookId: catalogBooks[0].id, quantity: 1 }] : [];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddItem = () => {
    if (catalogBooks.length === 0) return;
    setItems((prev) => [...prev, { bookId: catalogBooks[0].id, quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: keyof PackageItemInput, val: unknown) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          [field]: field === "bookId" ? val : Math.max(1, parseInt(String(val), 10) || 1),
        };
      })
    );
  };

  // Hitung total estimasi: komponen buku + 1 WPR wajib
  const computedPrice =
    items.reduce((sum, it) => {
      const b = catalogBooks.find((x) => x.id === it.bookId);
      return sum + effectiveSellPrice(b ?? {}) * (it.quantity || 0);
    }, 0) + WPR_PRICE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert("Kode paket dan nama paket wajib diisi.");
      return;
    }

    if (items.length === 0) {
      alert("Tambahkan minimal 1 komponen buku ke dalam paket.");
      return;
    }

    if (readyBundleCount > 0) {
      const confirmText = `Paket ini memiliki ${readyBundleCount} bundel fisik siap serah di cabang/gudang.\n\nMenyimpan perubahan akan otomatis membongkar seluruh bundel tersebut kembali menjadi buku satuan lepas di rak.\n\nLanjutkan pembaruan paket?`;
      if (!window.confirm(confirmText)) return;
    }

    setIsSubmitting(true);
    try {
      await updatePackage(pkg.id, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        gradeLevel,
        curriculumType,
        academicYear,
        price: computedPrice,
        description: description.trim() || undefined,
        items,
      });
      alert(`Paket "${name}" berhasil diperbarui.`);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui paket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E7F3FF] text-[#1877F2] flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#050505]">Edit Master Paket Buku</h2>
              <p className="text-xs text-[#65676B]">Perbarui spesifikasi BOM komponen buku dan metadata paket.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#65676B] hover:bg-[#F0F2F5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {readyBundleCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Perhatian: Ada {readyBundleCount} bundel fisik aktif!</p>
                <p className="mt-0.5 text-amber-700">
                  Menyimpan perubahan akan otomatis membongkar seluruh bundel siap serah menjadi stok buku satuan lepas di masing-masing sekolah/gudang.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Kode Paket *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PKG-SD1-INT"
                className="w-full text-xs font-mono font-semibold bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-xl px-3 py-2 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Tahun Ajaran *</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026/2027"
                className="w-full text-xs bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-xl px-3 py-2 outline-hidden"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Paket Buku *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Paket Buku Kelas 1 SD Internasional"
              className="w-full text-xs bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-xl px-3 py-2 outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Jenjang Kelas *</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full text-xs bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-xl px-3 py-2 outline-hidden"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    Kelas {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Tipe Kurikulum *</label>
              <select
                value={curriculumType}
                onChange={(e) => setCurriculumType(e.target.value as "international" | "national")}
                className="w-full text-xs bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-xl px-3 py-2 outline-hidden"
              >
                <option value="international">Internasional</option>
                <option value="national">Nasional</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Deskripsi Tambahan</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan opsional paket buku..."
              className="w-full text-xs bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-xl px-3 py-2 outline-hidden"
            />
          </div>

          {/* BOM Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#050505]">
                Daftar Komponen Buku (BOM) <span className="text-[#65676B] font-normal">({items.length} judul)</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-semibold text-[#1877F2] hover:bg-[#E7F3FF] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Buku
              </button>
            </div>

            <div className="space-y-2 border border-[#E4E6EB] p-3 rounded-xl bg-[#F7F8FA]">
              {items.map((item, idx) => {
                const b = catalogBooks.find((x) => x.id === item.bookId);
                const subtotal = effectiveSellPrice(b ?? {}) * (item.quantity || 0);

                return (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[#E4E6EB]">
                    <div className="flex-1 min-w-0">
                      <SearchableSingleSelect
                        options={catalogBooks.map((x) => ({
                          value: x.id,
                          label: `${x.title} (${x.isbn || "-"}) — ${formatRupiah(effectiveSellPrice(x))}`,
                        }))}
                        value={item.bookId}
                        onChange={(val) => handleUpdateItem(idx, "bookId", val)}
                        placeholder="Pilih judul buku..."
                      />
                    </div>
                    <div className="w-20 shrink-0">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                        className="w-full text-xs text-center font-bold bg-[#F0F2F5] rounded-lg p-2 border border-transparent focus:border-[#1877F2] focus:bg-white outline-hidden"
                        title="Kuantitas per paket"
                      />
                    </div>
                    <div className="w-24 shrink-0 text-right text-xs font-semibold text-[#050505]">
                      {formatRupiah(subtotal)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="p-1.5 text-[#65676B] hover:text-red-600 rounded-md hover:bg-[#F0F2F5] disabled:opacity-30 disabled:hover:text-[#65676B] shrink-0 transition-colors"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {/* Baris WPR info */}
              <div className="flex items-center justify-between text-xs text-[#65676B] bg-white px-3 py-2 rounded-lg border border-dashed border-[#CED0D4]">
                <span>Biaya WPR (Weekly Progress Report) — otomatis disertakan:</span>
                <span className="font-semibold text-[#050505]">{formatRupiah(WPR_PRICE)}</span>
              </div>
            </div>
          </div>

          {/* Footer Info & Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-[#E4E6EB]">
            <div>
              <p className="text-[11px] text-[#65676B]">Total Estimasi Harga Paket:</p>
              <p className="text-base font-extrabold text-[#1877F2]">{formatRupiah(computedPrice)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5] transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1877F2] text-white hover:bg-[#166FE5] shadow-xs active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
