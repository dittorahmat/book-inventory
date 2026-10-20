import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { OutstandingPo, PackageOption } from "../../lib/internal-orders-types";
import { getJson } from "../../lib/api";
import { ShipmentLinesTable, type ShipmentFormLine } from "./ShipmentLinesTable";

interface CreateInternalShipmentModalProps {
  schoolOptions: Array<{ id: string; name: string }>;
  onSubmitPoShipment: (
    poId: string,
    payload: { deliveryNoteNumber: string; shippedDate?: string; notes?: string; items: ShipmentFormLine[] }
  ) => Promise<{ shipmentId: string; status: string }>;
  onSubmitManualShipment: (payload: {
    destinationSchoolId: string;
    deliveryNoteNumber: string;
    shippedDate?: string;
    notes?: string;
    items: ShipmentFormLine[];
  }) => Promise<{ shipmentId: string }>;
  onClose: () => void;
  onCreated: (deliveryNoteNumber: string) => void;
}

export function CreateInternalShipmentModal({
  schoolOptions,
  onSubmitPoShipment,
  onSubmitManualShipment,
  onClose,
  onCreated,
}: CreateInternalShipmentModalProps) {
  const [mode, setMode] = useState<"with_po" | "manual">("with_po");
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [shippedDate, setShippedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const [outstandingList, setOutstandingList] = useState<OutstandingPo[]>([]);
  const [isLoadingOutstanding, setIsLoadingOutstanding] = useState(true);
  const [selectedPoId, setSelectedPoId] = useState("");

  const [manualSchoolId, setManualSchoolId] = useState(schoolOptions[0]?.id ?? "");
  const [packageCatalog, setPackageCatalog] = useState<PackageOption[]>([]);

  const [lines, setLines] = useState<ShipmentFormLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoadingOutstanding(true);
        const list = await getJson<OutstandingPo[]>("/api/internal-orders/outstanding", "Gagal memuat PO terutang.");
        if (!cancelled) setOutstandingList(list);
      } catch (err) {
        if (!cancelled) setFormError(err instanceof Error ? err.message : "Gagal memuat PO terutang.");
      } finally {
        if (!cancelled) setIsLoadingOutstanding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pkgs = await getJson<PackageOption[]>("/api/packages", "Gagal memuat katalog paket.");
        if (!cancelled) setPackageCatalog(pkgs);
      } catch {
        // Abaikan jika katalog opsional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectPo = (poId: string) => {
    setSelectedPoId(poId);
    setFormError(null);
    const po = outstandingList.find((p) => p.id === poId);
    if (!po) {
      setLines([]);
      return;
    }
    const suggestions: ShipmentFormLine[] = po.items
      .filter((i) => i.quantityRemaining > 0)
      .map((i) => ({
        id: i.id,
        packageId: i.packageId,
        packageName: i.packageName ?? i.packageCode ?? "Paket Buku",
        quantity: i.quantityRemaining,
        maxQuantity: i.quantityRemaining,
        isOutstandingFollowup: i.quantityFulfilled > 0,
      }));
    setLines(suggestions);
  };

  const handleModeChange = (newMode: "with_po" | "manual") => {
    setMode(newMode);
    setFormError(null);
    if (newMode === "manual") {
      setLines([{ packageId: "", quantity: 1 }]);
    } else {
      if (selectedPoId) handleSelectPo(selectedPoId);
      else setLines([]);
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!deliveryNoteNumber.trim()) {
      setFormError("Nomor Surat Jalan wajib diisi.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Minimal 1 item yang dikirim.");
      return;
    }
    if (lines.some((l) => !l.packageId)) {
      setFormError("Pastikan semua baris paket buku telah dipilih.");
      return;
    }
    if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) {
      setFormError("Kuantitas pengiriman tiap item minimal 1.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "with_po") {
        if (!selectedPoId) {
          setFormError("Pilih nomor PO yang akan dipenuhi.");
          return;
        }
        await onSubmitPoShipment(selectedPoId, {
          deliveryNoteNumber: deliveryNoteNumber.trim(),
          shippedDate: shippedDate || undefined,
          notes: notes.trim() || undefined,
          items: lines,
        });
      } else {
        if (!manualSchoolId) {
          setFormError("Pilih cabang tujuan pengiriman.");
          return;
        }
        await onSubmitManualShipment({
          destinationSchoolId: manualSchoolId,
          deliveryNoteNumber: deliveryNoteNumber.trim(),
          shippedDate: shippedDate || undefined,
          notes: notes.trim() || undefined,
          items: lines,
        });
      }
      onCreated(deliveryNoteNumber.trim());
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menerbitkan Surat Jalan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E4E6EB] bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#050505]">Terbitkan Surat Jalan Internal</h2>
            <p className="text-xs text-[#65676B]">Kirim stok buku/paket dari Gudang Pusat ke Cabang</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#CED0D4] p-1.5 text-[#65676B] hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2 rounded-xl border border-[#E4E6EB] bg-[#F8F9FA] p-1 text-xs">
            <button
              type="button"
              onClick={() => handleModeChange("with_po")}
              className={`flex-1 rounded-lg py-2 font-bold transition-colors ${
                mode === "with_po" ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"
              }`}
            >
              Penuhi PO Cabang Terutang
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("manual")}
              className={`flex-1 rounded-lg py-2 font-bold transition-colors ${
                mode === "manual" ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"
              }`}
            >
              Pengiriman Manual Bebas (Tanpa PO)
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#050505]">
                Nomor Surat Jalan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deliveryNoteNumber}
                onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                placeholder="Contoh: SJ-INT-2026-001"
                className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs text-[#050505] focus:border-[#1877F2] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#050505]">Tanggal Pengiriman</label>
              <input
                type="date"
                value={shippedDate}
                onChange={(e) => setShippedDate(e.target.value)}
                className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs text-[#050505] focus:border-[#1877F2] focus:outline-hidden"
              />
            </div>
          </div>

          {mode === "with_po" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#050505]">
                Pilih PO Cabang Terutang <span className="text-red-500">*</span>
              </label>
              {isLoadingOutstanding ? (
                <div className="flex items-center gap-2 py-2 text-xs text-[#65676B]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat daftar PO terutang...
                </div>
              ) : outstandingList.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  Tidak ada PO cabang yang berstatus terutang saat ini. Gunakan mode manual jika ingin mengirim buku.
                </p>
              ) : (
                <SearchableSingleSelect
                  options={outstandingList.map((po) => ({
                    value: po.id,
                    label: `${po.poNumber} — ${po.schoolName} (${po.items.length} item sisa)`,
                  }))}
                  value={selectedPoId}
                  onChange={(val) => handleSelectPo(val)}
                  placeholder="-- Pilih PO Cabang --"
                />
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#050505]">
                Cabang Tujuan <span className="text-red-500">*</span>
              </label>
              <SearchableSingleSelect
                options={schoolOptions.map((s) => ({ value: s.id, label: s.name }))}
                value={manualSchoolId}
                onChange={(val) => setManualSchoolId(val)}
                placeholder="-- Pilih Cabang Tujuan --"
              />
            </div>
          )}

          <ShipmentLinesTable
            mode={mode}
            lines={lines}
            packageCatalog={packageCatalog}
            onAddLine={() => setLines((prev) => [...prev, { packageId: "", quantity: 1 }])}
            onUpdateQty={(idx, qty) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: qty } : l)))}
            onSelectPackage={(idx, pkgId, pkgName) =>
              setLines((prev) =>
                prev.map((l, i) => (i === idx ? { ...l, packageId: pkgId, packageName: pkgName } : l))
              )
            }
            onRemoveLine={(idx) => setLines((prev) => prev.filter((_, i) => i !== idx))}
          />

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#050505]">Catatan Pengiriman (Opsional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Titip driver, armada ekspedisi..."
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs text-[#050505] focus:border-[#1877F2] focus:outline-hidden"
            />
          </div>

          {formError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-[#E4E6EB] pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-[#CED0D4] px-4 py-2 text-xs font-semibold text-[#65676B] hover:bg-[#F0F2F5] active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-[#1877F2] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Terbitkan Surat Jalan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
