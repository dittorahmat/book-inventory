import { useState } from "react";
import { Package, Plus, Trash2, X } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { UniformVariantRow } from "./uniform-admin-api";
import { createUniformPackage } from "./uniform-admin-api";
import { formatRupiah } from "../../lib/transfer-pricing";

interface CreateUniformPackageModalProps {
  variants: UniformVariantRow[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultAcademicYear?: string;
}

export function CreateUniformPackageModal({
  variants,
  isOpen,
  onClose,
  onSuccess,
  defaultAcademicYear = "2026/2027",
}: CreateUniformPackageModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<Array<{ variantId: string; quantity: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableVariants = variants.map((v) => ({
    value: v.variant.id,
    label: `${v.variant.name} (${v.variant.code}) - ${formatRupiah(v.variant.price)}`,
  }));

  const handleAddItem = () => {
    if (variants.length === 0) return;
    const unused = variants.find((v) => !items.some((it) => it.variantId === v.variant.id));
    const targetVariantId = unused ? unused.variant.id : variants[0].variant.id;
    setItems((prev) => [...prev, { variantId: targetVariantId, quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: "variantId" | "quantity", value: string | number) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          [field]: field === "variantId" ? String(value) : Math.max(1, Number(value) || 1),
        };
      })
    );
  };

  const computedPrice = items.reduce((sum, item) => {
    const v = variants.find((x) => x.variant.id === item.variantId);
    return sum + (v?.variant.price ?? 0) * (item.quantity || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError("Kode paket dan nama paket wajib diisi.");
      return;
    }
    if (items.length === 0) {
      setError("Tambahkan minimal 1 komponen seragam ke dalam paket.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createUniformPackage({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        academicYear: academicYear.trim(),
        price: computedPrice,
        description: description.trim() || undefined,
        items,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal membuat paket seragam baru.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#E7F3FF] text-[#1877F2] flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Buat Master Paket Seragam Baru</h3>
              <p className="text-[11px] text-[#65676B]">Definisikan komposisi BOM seragam untuk perakitan & pemesanan</p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Kode Paket *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Contoh: PKG-UNIF-SD-IKH-2026"
                required
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-mono font-bold text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Paket *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Paket Seragam SD Ikhwan Lengkap"
                required
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Tahun Ajaran *</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026/2027"
                required
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Total Harga Paket (Otomatis)</label>
              <div className="w-full px-3 py-2 bg-[#F0F2F5] border border-[#CED0D4] rounded-xl text-xs font-bold text-[#1877F2]">
                {formatRupiah(computedPrice)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Keterangan Tambahan</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsional: Keterangan isi set seragam..."
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
            />
          </div>

          <div className="pt-2 border-t border-[#E4E6EB] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#050505]">Komponen Penyusun Paket (BOM)</h4>
                <p className="text-[11px] text-[#65676B]">Tentukan daftar varian seragam dan jumlah per paket</p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E7F3FF] text-[#1877F2] font-semibold rounded-lg text-xs hover:bg-[#DBE7F2] active:scale-[0.98] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Komponen
              </button>
            </div>

            {items.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-[#CED0D4] rounded-xl text-xs text-[#65676B]">
                Belum ada komponen seragam yang dipilih. Klik tombol di atas untuk menambahkan.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const v = variants.find((x) => x.variant.id === item.variantId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-[#F8F9FA] border border-[#E4E6EB] rounded-xl"
                    >
                      <div className="flex-1">
                        <SearchableSingleSelect
                          label=""
                          options={availableVariants}
                          value={item.variantId}
                          onChange={(val) => handleUpdateItem(idx, "variantId", val)}
                          placeholder="Pilih varian seragam..."
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-center font-bold"
                        />
                      </div>
                      <span className="text-xs text-[#65676B] shrink-0">unit</span>
                      <div className="w-28 text-right text-xs font-semibold text-[#050505] shrink-0">
                        {formatRupiah((v?.variant.price ?? 0) * (item.quantity || 0))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#E4E6EB] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy || !code.trim() || !name.trim() || items.length === 0}
              className="px-5 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] disabled:opacity-50 transition-colors shadow-xs"
            >
              {busy ? "Menyimpan..." : "Simpan Master Paket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
