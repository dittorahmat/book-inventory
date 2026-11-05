import { useState } from "react";
import { updateUniformPackage, deleteUniformPackage, type UniformPackageRow, type UniformVariantRow } from "./uniform-admin-api";

interface EditUniformPackageModalProps {
  packageRow: UniformPackageRow;
  variants: UniformVariantRow[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputCls =
  "w-full px-3 py-2 border border-[#CED0D4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]";
const labelCls = "block text-[11px] font-semibold text-[#65676B] mb-1";

export function EditUniformPackageModal({
  packageRow,
  variants,
  isOpen,
  onClose,
  onSuccess,
}: EditUniformPackageModalProps) {
  const { package: pkg, bom: initialBom, readyQty } = packageRow;

  const [name, setName] = useState(pkg.name);
  const [code, setCode] = useState(pkg.code);
  const [academicYear, setAcademicYear] = useState(pkg.academicYear);
  const [price, setPrice] = useState(String(pkg.price));
  const [description, setDescription] = useState(pkg.description ?? "");
  const [items, setItems] = useState<Array<{ variantId: string; size?: string; quantity: number }>>(
    initialBom.map((b) => ({ variantId: b.variantId, size: b.size, quantity: b.quantity }))
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const toggleVariant = (vId: string) => {
    if (items.some((item) => item.variantId === vId)) {
      setItems(items.filter((item) => item.variantId !== vId));
    } else {
      setItems([...items, { variantId: vId, quantity: 1 }]);
    }
  };

  const updateQuantity = (vId: string, qty: number) => {
    setItems(items.map((item) => (item.variantId === vId ? { ...item, quantity: Math.max(1, qty) } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError("Paket wajib memiliki minimal satu komponen.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await updateUniformPackage(pkg.id, {
        name,
        code,
        academicYear,
        price: Number(price) || 0,
        description: description.trim() || null,
        items,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui paket.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (readyQty > 0) {
      setError(`Paket tidak dapat dihapus karena masih ada ${readyQty} bundel rakitan siap kirim.`);
      return;
    }
    if (!confirm(`Hapus paket seragam ${pkg.name} (${pkg.code}) secara permanen?`)) return;

    setError(null);
    setDeleting(true);

    try {
      await deleteUniformPackage(pkg.id);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menghapus paket.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E4E6EB] max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E6EB]">
          <div>
            <h3 className="text-base font-bold text-[#050505]">Edit Paket Seragam</h3>
            <p className="text-xs text-[#65676B]">ID: {pkg.id} · Siap Kirim: {readyQty} unit</p>
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
              <label className={labelCls}>Kode Paket</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nama Paket</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tahun Ajaran</label>
              <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Harga Paket (Rp)</label>
              <input value={price} inputMode="numeric" onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Deskripsi</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opsional" className={inputCls} />
          </div>

          <div className="space-y-2 pt-2 border-t border-[#E4E6EB]">
            <label className={labelCls}>Pilih Komponen Penyusun (BOM):</label>
            <div className="flex flex-wrap gap-1.5">
              {variants.map(({ variant: v }) => {
                const isSelected = items.some((item) => item.variantId === v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVariant(v.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      isSelected
                        ? "bg-[#1877F2] text-white border-[#1877F2]"
                        : "bg-white text-[#050505] border-[#CED0D4] hover:bg-[#F0F2F5]"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {v.name} ({v.code})
                  </button>
                );
              })}
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E4E6EB]">
              <span className="text-xs font-bold text-[#050505]">Atur Kuantitas per Paket:</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => {
                  const v = variants.find((x) => x.variant.id === item.variantId);
                  return (
                    <div
                      key={item.variantId}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#F8F9FA] border border-[#E4E6EB]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#050505] truncate">{v?.variant.name ?? item.variantId}</p>
                        <p className="text-[10px] text-[#65676B]">Kode: {v?.variant.code}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-[10px] font-semibold text-[#65676B]">Qty:</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.variantId, parseInt(e.target.value) || 1)}
                          className="w-14 px-2 py-1 border border-[#CED0D4] rounded-lg text-xs text-center"
                        />
                      </div>
                    </div>
                  );
                })}
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
              {deleting ? "Menghapus..." : "Hapus Paket"}
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
