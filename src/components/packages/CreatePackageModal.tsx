import { useState } from "react";
import { Package, Plus, Trash2, X } from "lucide-react";
import type { Book } from "../../types";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { NewPackagePayload } from "./usePackagesData";

interface NewPackageItemInput {
  bookId: string;
  quantity: number;
}

interface CreatePackageModalProps {
  catalogBooks: Book[];
  createPackage: (payload: NewPackagePayload) => Promise<void>;
  onClose: () => void;
  onCreated: () => void;
}

/** Harga jual efektif komponen: delegasi ke kanonik book-pricing. */
const effectiveSellOf = (book: Book | undefined): number => effectiveSellPrice(book ?? {});

/** Modal master paket baru (BOM): form + baris komponen + harga otomatis. */
export function CreatePackageModal({ catalogBooks, createPackage, onClose, onCreated }: CreatePackageModalProps) {
  const [newPkgGrade, setNewPkgGrade] = useState("1");
  const [newPkgCurriculum, setNewPkgCurriculum] = useState<"international" | "national">("international");
  const stamp = Date.now().toString().slice(-4);
  const [newPkgCode, setNewPkgCode] = useState(`PKG-SD1-INT-${stamp}`);
  const [newPkgName, setNewPkgName] = useState("Paket Buku Kelas 1 SD Internasional");
  const [newPkgYear, setNewPkgYear] = useState("2026/2027");
  const [newPkgDescription, setNewPkgDescription] = useState("");
  const [newPkgItems, setNewPkgItems] = useState<NewPackageItemInput[]>(
    catalogBooks.length > 0 ? [{ bookId: catalogBooks[0].id, quantity: 1 }] : []
  );
  const [isSubmittingPackage, setIsSubmittingPackage] = useState(false);

  const handleAddBOMItem = () => {
    if (catalogBooks.length === 0) return;
    setNewPkgItems((prev) => [
      ...prev,
      { bookId: catalogBooks[0].id, quantity: 1 },
    ]);
  };

  const handleRemoveBOMItem = (index: number) => {
    setNewPkgItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateBOMItem = (index: number, field: keyof NewPackageItemInput, val: any) => {
    setNewPkgItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          [field]: field === "bookId" ? val : Math.max(0, parseInt(val) || 0),
        };
      })
    );
  };

  const computedPkgPrice = newPkgItems.reduce(
    (sum, it) => sum + effectiveSellOf(catalogBooks.find((x) => x.id === it.bookId)) * (it.quantity || 0),
    0
  );

  const handleSubmitCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkgCode.trim() || !newPkgName.trim()) {
      alert("Kode paket dan nama paket wajib diisi.");
      return;
    }

    if (newPkgItems.length === 0) {
      alert("Tambahkan minimal 1 komponen buku ke dalam paket.");
      return;
    }

    setIsSubmittingPackage(true);
    try {
      await createPackage({
        code: newPkgCode.trim().toUpperCase(),
        name: newPkgName.trim(),
        gradeLevel: newPkgGrade,
        curriculumType: newPkgCurriculum,
        academicYear: newPkgYear,
        price: computedPkgPrice,
        description: newPkgDescription.trim() || undefined,
        items: newPkgItems,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingPackage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E7F3FF] text-[#1877F2] flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Buat Master Paket Buku Baru (BOM)</h3>
              <p className="text-[11px] text-[#65676B]">Definisikan komposisi buku per paket untuk perakitan stok & penagihan murid</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitCreatePackage} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Kode Paket *
              </label>
              <input
                type="text"
                value={newPkgCode}
                onChange={(e) => setNewPkgCode(e.target.value.toUpperCase())}
                placeholder="Contoh: PKG-SD1-INT-2026"
                required
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-mono font-bold text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Nama Paket *
              </label>
              <input
                type="text"
                value={newPkgName}
                onChange={(e) => setNewPkgName(e.target.value)}
                placeholder="Contoh: Paket Kelas 1 SD Internasional"
                required
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Tingkat Kelas *
              </label>
              <select
                value={newPkgGrade}
                onChange={(e) => setNewPkgGrade(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g.toString()}>
                    Kelas {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Kurikulum *
              </label>
              <select
                value={newPkgCurriculum}
                onChange={(e) => setNewPkgCurriculum(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              >
                <option value="international">Internasional (Cambridge)</option>
                <option value="national">Nasional (Kemendikbud)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Tahun Ajaran *
              </label>
              <input
                type="text"
                value={newPkgYear}
                onChange={(e) => setNewPkgYear(e.target.value)}
                placeholder="Contoh: 2026/2027"
                required
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Harga Paket (Rp) — Otomatis
              </label>
              <div className="w-full px-3 py-2 bg-[#F0F2F5] border border-[#E4E6EB] rounded-xl text-xs font-bold text-[#050505]">
                {formatRupiah(computedPkgPrice)}
              </div>
              <p className="text-[10px] text-[#65676B] mt-1">
                Dihitung otomatis: jumlah harga jual × qty tiap komponen.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E4E6EB]">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-[#050505]">
                Daftar Komponen Buku Paket (BOM) ({newPkgItems.length} Buku)
              </label>
              <button
                type="button"
                onClick={handleAddBOMItem}
                className="text-[#1877F2] hover:text-[#166FE5] text-xs font-semibold flex items-center gap-1 active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Komponen Buku</span>
              </button>
            </div>

            {catalogBooks.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                Katalog buku masih kosong. Tambahkan buku di tab <strong>Katalog</strong> terlebih dahulu.
              </div>
            ) : newPkgItems.length === 0 ? (
              <div className="p-4 bg-[#F0F2F5] border border-dashed border-[#CED0D4] rounded-xl text-center text-[#65676B]">
                Belum ada buku dalam paket ini. Klik <strong>Tambah Komponen Buku</strong> untuk memilih dari katalog.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {newPkgItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#F9FAFB] border border-[#E4E6EB] rounded-xl grid grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="col-span-12 sm:col-span-8">
                      <label className="block text-[10px] text-[#65676B] mb-0.5">Judul Buku dari Katalog</label>
                      <select
                        value={item.bookId}
                        onChange={(e) => handleUpdateBOMItem(idx, "bookId", e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] font-medium"
                      >
                        {catalogBooks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} ({b.isbn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-8 sm:col-span-3">
                      <label className="block text-[10px] text-[#65676B] mb-0.5">Jumlah Per Paket (Eks)</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="0"
                        value={item.quantity === 0 ? "" : item.quantity}
                        onChange={(e) => handleUpdateBOMItem(idx, "quantity", e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-center font-bold text-[#1877F2]"
                      />
                    </div>

                    <div className="col-span-4 sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveBOMItem(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus baris komponen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Deskripsi / Catatan Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={newPkgDescription}
              onChange={(e) => setNewPkgDescription(e.target.value)}
              placeholder="Informasi tambahan terkait paket buku ini..."
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
            />
          </div>

          <div className="pt-3 border-t border-[#E4E6EB] flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-xl font-semibold text-[#65676B] transition-colors active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingPackage}
              className="px-5 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmittingPackage ? "Menyimpan..." : "Simpan Master Paket"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
