import { useState } from "react";
import { updateUniformVariant, deleteUniformVariant, type UniformVariantRow } from "./uniform-admin-api";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";

interface EditUniformVariantModalProps {
  variantRow: UniformVariantRow;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputCls =
  "w-full px-3 py-2 border border-[#CED0D4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]";
const labelCls = "block text-[11px] font-semibold text-[#65676B] mb-1";

export function EditUniformVariantModal({
  variantRow,
  isOpen,
  onClose,
  onSuccess,
}: EditUniformVariantModalProps) {
  const { variant, sizes: initialSizes, stock } = variantRow;

  const [name, setName] = useState(variant.name);
  const [code, setCode] = useState(variant.code);
  const [kind, setKind] = useState(variant.kind);
  const [gender, setGender] = useState(variant.gender);
  const [jenjang, setJenjang] = useState(variant.jenjang);
  const [academicYear, setAcademicYear] = useState(variant.academicYear);
  const [price, setPrice] = useState(String(variant.price));
  const [sizeChartUrl, setSizeChartUrl] = useState(variant.sizeChartUrl ?? "");
  const [sizes, setSizes] = useState<string[]>(initialSizes);
  const [newSizeInput, setNewSizeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const handleAddSize = () => {
    const trimmed = newSizeInput.trim().toUpperCase();
    if (!trimmed) return;
    if (sizes.includes(trimmed)) {
      setError(`Ukuran ${trimmed} sudah ada.`);
      return;
    }
    setSizes([...sizes, trimmed]);
    setNewSizeInput("");
    setError(null);
  };

  const handleRemoveSize = (sizeToRemove: string) => {
    const sizeStock = stock.find((s) => s.size === sizeToRemove)?.quantity ?? 0;
    if (sizeStock > 0) {
      setError(`Ukuran ${sizeToRemove} tidak dapat dihapus karena memiliki saldo stok fisik (${sizeStock} unit).`);
      return;
    }
    setSizes(sizes.filter((s) => s !== sizeToRemove));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await updateUniformVariant(variant.id, {
        name,
        code,
        kind,
        gender,
        jenjang,
        academicYear,
        price: Number(price) || 0,
        sizeChartUrl: sizeChartUrl.trim() || null,
        sizes: kind === "kain_harian" ? [] : sizes,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui varian.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Hapus varian ${variant.name} (${variant.code}) secara permanen?`)) return;
    setError(null);
    setDeleting(true);

    try {
      await deleteUniformVariant(variant.id);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menghapus varian.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E4E6EB] max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E6EB]">
          <div>
            <h3 className="text-base font-bold text-[#050505]">Edit Varian Seragam</h3>
            <p className="text-xs text-[#65676B]">ID: {variant.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#65676B] hover:text-[#050505] text-lg font-semibold px-2"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Kode Varian</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nama Varian</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <SearchableSingleSelect
                label="Jenis"
                options={[
                  { value: "kain_harian", label: "Kain Harian" },
                  { value: "olahraga", label: "Olahraga" },
                ]}
                value={kind}
                onChange={setKind}
              />
            </div>
            <div>
              <SearchableSingleSelect
                label="Gender"
                options={[
                  { value: "male", label: "Laki-laki (Ikhwan)" },
                  { value: "female", label: "Perempuan (Akhwat)" },
                ]}
                value={gender}
                onChange={setGender}
              />
            </div>
            <div>
              <SearchableSingleSelect
                label="Jenjang"
                options={[
                  { value: "tk", label: "TK" },
                  { value: "sd", label: "SD" },
                  { value: "smp", label: "SMP" },
                  { value: "sma", label: "SMA" },
                ]}
                value={jenjang}
                onChange={setJenjang}
              />
            </div>
            <div>
              <label className={labelCls}>Tahun Ajaran</label>
              <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Harga Satuan (Rp)</label>
              <input value={price} inputMode="numeric" onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>URL Panduan Ukuran (Opsional)</label>
              <input value={sizeChartUrl} onChange={(e) => setSizeChartUrl(e.target.value)} placeholder="https://..." className={inputCls} />
            </div>
          </div>

          {kind === "olahraga" && (
            <div className="space-y-2 pt-2 border-t border-[#E4E6EB]">
              <label className={labelCls}>Daftar Ukuran Aktif</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {sizes.map((s) => {
                  const sStock = stock.find((st) => st.size === s)?.quantity ?? 0;
                  return (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F0F2F5] text-[#050505] border border-[#CED0D4]"
                    >
                      {s} ({sStock} unit)
                      <button
                        type="button"
                        onClick={() => handleRemoveSize(s)}
                        className="text-[#65676B] hover:text-red-600 font-bold ml-1"
                        title="Hapus ukuran"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSizeInput}
                  onChange={(e) => setNewSizeInput(e.target.value)}
                  placeholder="Tambah ukuran (cth: XL)"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={handleAddSize}
                  className="px-3 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] rounded-xl text-xs font-semibold whitespace-nowrap"
                >
                  + Tambah Size
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-[#E4E6EB]">
            <button
              type="button"
              disabled={deleting || loading}
              onClick={handleDelete}
              className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {deleting ? "Menghapus..." : "Hapus Varian"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5] rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || deleting}
                className="px-4 py-2 bg-[#1877F2] text-white hover:bg-[#1664D9] rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
