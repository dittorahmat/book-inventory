import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import type { PackageOption } from "../../lib/internal-orders-types";
import { fetchPackageOptions } from "./internal-orders-api";

interface OrderLine {
  packageId: string;
  quantityOrdered: number;
}

interface CreateInternalOrderModalProps {
  schoolId: string;
  schoolName: string;
  schoolOptions: Array<{ id: string; name: string }>;
  canChooseSchool: boolean;
  onSchoolChange: (schoolId: string) => void;
  onSubmit: (payload: { schoolId: string; notes?: string; items: OrderLine[] }) => Promise<{ poNumber: string }>;
  onClose: () => void;
  onCreated: (poNumber: string) => void;
}

/** Form IPO cabang → gudang: pilih paket + jumlah, pantau status setelah terbit. */
export function CreateInternalOrderModal({
  schoolId,
  schoolName,
  schoolOptions,
  canChooseSchool,
  onSchoolChange,
  onSubmit,
  onClose,
  onCreated,
}: CreateInternalOrderModalProps) {
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([{ packageId: "", quantityOrdered: 1 }]);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPackageOptions();
        if (!cancelled) setPackages(list);
      } catch (err) {
        if (!cancelled) setPackagesError(err instanceof Error ? err.message : "Gagal memuat katalog paket.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLine = (index: number, patch: Partial<OrderLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const handleSubmit = async () => {
    setFormError(null);
    const items = lines.filter((l) => l.packageId);
    if (items.length === 0) {
      setFormError("Pilih minimal 1 paket buku yang dipesan.");
      return;
    }
    if (items.some((l) => !Number.isInteger(l.quantityOrdered) || l.quantityOrdered < 1)) {
      setFormError("Jumlah tiap paket minimal 1.");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await onSubmit({ schoolId, notes: notes.trim() || undefined, items });
      onCreated(created.poNumber);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal membuat pesanan ke gudang.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl space-y-4 rounded-2xl border border-[#E4E6EB] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-3">
          <h2 className="text-base font-bold text-[#050505]">Buat Pesanan ke Gudang</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-xl p-2 text-[#65676B] hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#050505]">Cabang Pemesan</label>
          {canChooseSchool ? (
            <select
              value={schoolId}
              onChange={(e) => onSchoolChange(e.target.value)}
              className="w-full rounded-xl border border-[#CED0D4] bg-white p-2.5 text-xs font-medium text-[#050505] focus:border-[#1877F2] focus:outline-none"
            >
              {schoolOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-xl border border-[#E4E6EB] bg-[#F8F9FA] px-3 py-2.5 text-xs font-bold text-[#050505]">
              {schoolName}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <span className="block text-xs font-semibold text-[#050505]">Paket yang Dipesan</span>
          {lines.map((line, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[#65676B]">Paket buku</label>
                <select
                  value={line.packageId}
                  onChange={(e) => setLine(i, { packageId: e.target.value })}
                  className="w-full rounded-xl border border-[#CED0D4] bg-white p-2.5 text-xs font-medium text-[#050505] focus:border-[#1877F2] focus:outline-none"
                >
                  <option value="">Pilih paket…</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs font-medium text-[#65676B]">Jumlah</label>
                <input
                  type="number"
                  min={1}
                  value={line.quantityOrdered}
                  onChange={(e) => setLine(i, { quantityOrdered: Number(e.target.value) })}
                  className="w-full rounded-xl border border-[#CED0D4] p-2.5 text-xs text-[#050505] focus:border-[#1877F2] focus:outline-none"
                />
              </div>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Hapus baris"
                  className="rounded-xl border border-[#CED0D4] p-2.5 text-[#65676B] hover:bg-[#F0F2F5] active:scale-[0.98]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { packageId: "", quantityOrdered: 1 }])}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1877F2] hover:underline active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah paket
          </button>
          {packagesError && <p className="text-xs text-red-700">{packagesError}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#050505]">Catatan (opsional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Contoh: kebutuhan semester genap kelas 1–3"
            className="w-full rounded-xl border border-[#CED0D4] p-2.5 text-xs text-[#050505] placeholder-[#8A8D91] focus:border-[#1877F2] focus:outline-none"
          />
        </div>

        {formError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#CED0D4] bg-white px-4 py-2 text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1877F2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166FE5] disabled:opacity-60 active:scale-[0.98]"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Kirim Pesanan
          </button>
        </div>
      </div>
    </div>
  );
}
