import { useState, useEffect } from "react";
import { X, Send } from "lucide-react";
import type { School } from "../../types";
import { formatRupiah, calcHeaderTotal } from "../../lib/transfer-pricing";
import { buildQuery, getJson, postJson } from "../../lib/api";
import type { ReadyBundle } from "../transfers/PackagePicker";

interface PackageTransferModalProps {
  packageId: string;
  packageCode: string;
  packageName: string;
  packagePrice: number;
  activeSchool: School | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PackageTransferModal({
  packageId,
  packageCode,
  packageName,
  packagePrice,
  activeSchool,
  onClose,
  onSuccess,
}: PackageTransferModalProps) {
  const [bundles, setBundles] = useState<ReadyBundle[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [destinationSchoolId, setDestinationSchoolId] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!activeSchool) return;
    setIsLoading(true);
    (async () => {
      try {
        const [ready, schools] = await Promise.all([
          getJson<ReadyBundle[]>(
            buildQuery("/api/packages/items/ready", { schoolId: activeSchool.id }),
            "Gagal memuat bundel ready"
          ),
          getJson<School[]>("/api/schools", "Gagal memuat daftar sekolah."),
        ]);
        setBundles(ready.filter((b) => b.packageId === packageId));
        setAllSchools(schools);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memuat data transfer");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [activeSchool, packageId]);

  const total = calcHeaderTotal(
    selectedIds.map((id) => {
      const b = bundles.find((x) => x.id === id);
      return { unitPriceSnapshot: b?.packagePrice || 0, quantity: 1 };
    })
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchool || !destinationSchoolId || selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const created = await postJson<{ shipmentNumber: string; totalDeclaredValue?: number }>(
        "/api/shipments",
        {
          fromSchoolId: activeSchool.id,
          toSchoolId: destinationSchoolId,
          bookItemIds: [],
          packageItemIds: selectedIds,
          reason: reason.trim() || undefined,
          notes: `Transfer paket ${packageCode} dari tab Bundling`,
        },
        "Gagal membuat draf transfer paket."
      );
      alert(`Draf ${created.shipmentNumber} tersimpan! Nilai: ${formatRupiah(created.totalDeclaredValue || 0)}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan jaringan saat menyimpan draf");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-[#050505]">Transfer Paket Langsung</h3>
            <p className="text-[11px] text-[#65676B]">
              {packageCode} - {packageName} &bull; {formatRupiah(packagePrice)} / paket
            </p>
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
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Sekolah / Cabang Tujuan
            </label>
            <select
              required
              value={destinationSchoolId}
              onChange={(e) => setDestinationSchoolId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
            >
              <option value="">Pilih tujuan transfer...</option>
              {allSchools
                .filter((s) => s.id !== activeSchool?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Pilih Bundel Ready ({bundles.length} tersedia)
            </label>
            {isLoading ? (
              <div className="p-6 text-center text-[#65676B] bg-[#F0F2F5] rounded-xl">
                Memuat bundel ready...
              </div>
            ) : bundles.length === 0 ? (
              <div className="p-6 text-center bg-[#F0F2F5] border border-dashed border-[#CED0D4] rounded-xl text-[#65676B]">
                Belum ada bundel ready untuk paket ini. Klik <strong>Rakit Paket</strong> terlebih dahulu.
              </div>
            ) : (
              <div className="border border-[#E4E6EB] rounded-xl max-h-48 overflow-y-auto divide-y divide-[#E4E6EB] p-2 bg-[#F0F2F5]">
                {bundles.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(b.id)}
                        onChange={() => toggle(b.id)}
                        className="rounded border-[#CED0D4] text-[#1877F2] focus:ring-[#1877F2] w-4 h-4"
                      />
                      <span className="font-mono text-xs font-bold text-[#1877F2]">{b.barcode}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#1877F2]">
                      {formatRupiah(b.packagePrice)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Alasan / Keterangan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Pemenuhan kuota kurikulum..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
            />
          </div>

          <div className="flex items-center justify-between bg-[#E7F3FF] border border-[#1877F2]/20 rounded-xl px-3.5 py-2.5">
            <span className="text-xs font-bold text-[#050505]">
              Total Nilai ({selectedIds.length} paket)
            </span>
            <span className="text-sm font-bold text-[#1877F2]">{formatRupiah(total)}</span>
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
              disabled={isSubmitting || !destinationSchoolId || selectedIds.length === 0}
              className="px-5 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? "Menyimpan..." : "Buat Draf Transfer"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
