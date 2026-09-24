import { useState } from "react";
import { X, Layers, AlertCircle, ArrowRight } from "lucide-react";
import { School } from "../types";

interface BookPackage {
  id: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  price: number;
  items: Array<{
    bookId: string;
    title: string;
    isbn: string;
    quantity: number;
  }>;
}

interface StockPotential {
  packageId: string;
  schoolId: string;
  readyBundleCount: number;
  maxPossibleBundles: number;
  looseStockBreakdown: Array<{
    bookId: string;
    title: string;
    isbn: string;
    quantityNeeded: number;
    availableLooseStock: number;
    maxBundlesFromComponent: number;
  }>;
}

interface BundlingModalProps {
  pkg: BookPackage;
  activeSchool: School | null;
  stockPotential: StockPotential | null;
  mode: "bundle" | "unbundle";
  onClose: () => void;
  onSuccess: () => void;
}

export function BundlingModal({
  pkg,
  activeSchool,
  stockPotential,
  mode,
  onClose,
  onSuccess,
}: BundlingModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!activeSchool) return null;

  const maxAllowed = mode === "bundle"
    ? (stockPotential?.maxPossibleBundles ?? 0)
    : (stockPotential?.readyBundleCount ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (quantity <= 0) {
      setErrorMsg("Jumlah harus lebih dari 0.");
      return;
    }

    if (quantity > maxAllowed) {
      setErrorMsg(
        mode === "bundle"
          ? `Maksimal perakitan hanya ${maxAllowed} paket berdasarkan sisa stok satuan.`
          : `Maksimal pembongkaran hanya ${maxAllowed} paket yang tersedia di gudang.`
      );
      return;
    }

    if (mode === "unbundle" && !reason.trim()) {
      setErrorMsg("Alasan pembongkaran paket wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = mode === "bundle"
        ? `/api/packages/${pkg.id}/bundle`
        : `/api/packages/${pkg.id}/unbundle`;

      const payload = mode === "bundle"
        ? { schoolId: activeSchool.id, quantity }
        : { schoolId: activeSchool.id, quantity, reason: reason.trim() };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memproses operasi stok");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses data");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              mode === "bundle" ? "bg-[#E7F3FF] text-[#1877F2]" : "bg-amber-50 text-amber-700"
            }`}>
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#050505]">
                {mode === "bundle" ? "Rakit Paket Baru (Bundling)" : "Bongkar Paket (Unbundling)"}
              </h3>
              <p className="text-xs text-[#65676B]">{pkg.name} &bull; {activeSchool.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F0F2F5] text-[#65676B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Context Summary */}
          <div className="bg-[#F0F2F5] p-3.5 rounded-xl text-xs space-y-1">
            <div className="flex justify-between text-[#65676B]">
              <span>Stok Paket Siap Serah Sekarang:</span>
              <span className="font-semibold text-[#050505]">{stockPotential?.readyBundleCount ?? 0} box</span>
            </div>
            <div className="flex justify-between text-[#65676B]">
              <span>Potensi Rakit dari Stok Satuan (Loose):</span>
              <span className="font-semibold text-[#1877F2]">{stockPotential?.maxPossibleBundles ?? 0} box</span>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1.5">
              Jumlah Paket yang Ingin {mode === "bundle" ? "Dirakit" : "Dibongkar"}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={Math.max(1, maxAllowed)}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-sm font-semibold text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
              <button
                type="button"
                onClick={() => setQuantity(maxAllowed)}
                disabled={maxAllowed <= 0}
                className="px-3 py-2.5 text-xs font-semibold bg-[#E7F3FF] text-[#1877F2] hover:bg-[#D8ECFF] rounded-xl transition-colors shrink-0 disabled:opacity-50"
              >
                Maks ({maxAllowed})
              </button>
            </div>
          </div>

          {mode === "unbundle" && (
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1.5">
                Alasan Pembongkaran (Audit Log)
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Alokasi stok satuan untuk penggantian retur buku cacat"
                className="w-full px-3.5 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
          )}

          {/* BOM Breakdown Preview */}
          <div className="border border-[#E4E6EB] rounded-xl overflow-hidden">
            <div className="px-3.5 py-2 bg-[#F7F8FA] border-b border-[#E4E6EB] text-[11px] font-semibold text-[#65676B]">
              Komponen Buku Satuan (BOM):
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-[#E4E6EB] text-xs">
              {stockPotential?.looseStockBreakdown.map((item) => {
                const requiredNow = item.quantityNeeded * quantity;
                const isShortage = mode === "bundle" && item.availableLooseStock < requiredNow;

                return (
                  <div key={item.bookId} className="px-3.5 py-2 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-[#050505] truncate">{item.title}</div>
                      <div className="text-[10px] text-[#65676B]">ISBN: {item.isbn}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-semibold ${isShortage ? "text-red-600" : "text-[#050505]"}`}>
                        {mode === "bundle" ? `-${requiredNow}` : `+${requiredNow}`} pcs
                      </div>
                      <div className="text-[10px] text-[#65676B]">
                        Stok loose: {item.availableLooseStock}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#65676B] hover:bg-[#F0F2F5] rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || maxAllowed <= 0}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 ${
                mode === "bundle"
                  ? "bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-gray-300"
                  : "bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300"
              }`}
            >
              {isSubmitting ? (
                "Memproses..."
              ) : (
                <>
                  <span>{mode === "bundle" ? "Konfirmasi Rakit" : "Konfirmasi Bongkar"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
