import { useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { formatRupiah } from "../../lib/transfer-pricing";
import { UNIFORM_INPUT_CLS, UNIFORM_LABEL_CLS } from "./uniform-styles";
import type { UniformVariantRow } from "./uniform-admin-api";

export interface UniformPoLineItem {
  variantId: string;
  size: string;
  quantityOrdered: number;
  unitPrice: number;
}

interface CreateUniformPoModalProps {
  isOpen: boolean;
  suppliers: Array<{ id: string; name: string }>;
  variants: UniformVariantRow[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    supplierId: string;
    lines: Array<{ variantId: string; size?: string; quantityOrdered: number; unitPrice: number }>;
  }) => Promise<void>;
  onOpenSupplierModal: () => void;
}

export function CreateUniformPoModal({
  isOpen,
  suppliers,
  variants,
  busy,
  onClose,
  onSubmit,
  onOpenSupplierModal,
}: CreateUniformPoModalProps) {
  const [poSupplier, setPoSupplier] = useState("");
  const [poLines, setPoLines] = useState<UniformPoLineItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const supplierRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleAddLine = (variantId: string) => {
    const v = variants.find((x) => x.variant.id === variantId);
    if (!v) return;
    setPoLines((prev) => [
      ...prev,
      { variantId: v.variant.id, size: "", quantityOrdered: 10, unitPrice: v.variant.price },
    ]);
    if (fieldErrors.lines) {
      setFieldErrors((prev) => ({ ...prev, lines: undefined }));
    }
  };

  const handleRemoveLine = (idx: number) => {
    setPoLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateLine = (idx: number, updates: Partial<UniformPoLineItem>) => {
    setPoLines((prev) => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string | undefined> = {};

    if (!poSupplier) {
      errors.supplier = "Pilih mitra konveksi / supplier terlebih dahulu.";
    }
    if (poLines.length === 0) {
      errors.lines = "Tambahkan minimal 1 item baris pesanan PO.";
    } else {
      const invalidQty = poLines.some((l) => !l.quantityOrdered || l.quantityOrdered <= 0);
      if (invalidQty) {
        errors.quantity = "Kuantitas pemesanan tiap baris minimal 1 unit.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.supplier && supplierRef.current) {
        supplierRef.current.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    setFieldErrors({});
    await onSubmit({
      supplierId: poSupplier,
      lines: poLines.map((l) => ({
        variantId: l.variantId,
        size: l.size.trim() || undefined,
        quantityOrdered: l.quantityOrdered,
        unitPrice: l.unitPrice,
      })),
    });
  };

  const grandTotal = poLines.reduce(
    (acc, curr) => acc + (curr.quantityOrdered || 0) * (curr.unitPrice || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E4E6EB]">
          <div>
            <h3 className="text-base font-bold text-[#050505]">Buat PO Konveksi Baru</h3>
            <p className="text-xs text-[#65676B] mt-0.5">Terbitkan Purchase Order produksi kain atau set seragam ke mitra konveksi.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <FormSummaryAlert errors={fieldErrors} title="Formulir PO Belum Lengkap" />

          <div ref={supplierRef}>
            <div className="flex items-center justify-between mb-1">
              <label className={UNIFORM_LABEL_CLS}>Mitra Konveksi / Supplier *</label>
              <button
                type="button"
                onClick={onOpenSupplierModal}
                className="text-[11px] font-bold text-[#1877F2] hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Tambah Konveksi Baru
              </button>
            </div>
            <div className={fieldErrors.supplier ? "rounded-xl ring-2 ring-rose-500" : ""}>
              <SearchableSingleSelect
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                value={poSupplier}
                onChange={(val) => {
                  setPoSupplier(val);
                  setFieldErrors((prev) => ({ ...prev, supplier: undefined }));
                }}
                placeholder={suppliers.length === 0 ? "Belum ada mitra konveksi (Klik Tambah Baru)" : "— Pilih mitra konveksi —"}
              />
            </div>
            <FormFieldFeedback error={fieldErrors.supplier} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={UNIFORM_LABEL_CLS}>Pilih Varian Item Seragam:</label>
              <span className="text-[11px] text-[#65676B]">Klik untuk menambahkan ke daftar</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-[#E4E6EB] rounded-xl bg-[#F8F9FA]">
              {variants.map(({ variant: v }) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleAddLine(v.id)}
                  className="px-2.5 py-1 rounded-lg border border-[#CED0D4] bg-white text-[11px] font-semibold text-[#050505] hover:border-[#1877F2] hover:text-[#1877F2] transition-colors shadow-2xs"
                >
                  + {v.name} ({v.code})
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className={UNIFORM_LABEL_CLS}>Rincian Item Pesanan ({poLines.length}):</label>
            <FormFieldFeedback error={fieldErrors.lines || fieldErrors.quantity} />

            {poLines.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#65676B] border border-dashed border-[#CED0D4] rounded-xl">
                Belum ada item yang dipilih. Klik tombol varian seragam di atas.
              </div>
            ) : (
              <div className="space-y-2">
                {poLines.map((line, idx) => {
                  const v = variants.find((x) => x.variant.id === line.variantId)?.variant;
                  return (
                    <div
                      key={`${line.variantId}-${idx}`}
                      className="grid grid-cols-12 gap-2 items-center p-2.5 bg-[#F8F9FA] border border-[#E4E6EB] rounded-xl text-xs"
                    >
                      <div className="col-span-12 sm:col-span-4 min-w-0">
                        <span className="font-bold text-[#050505] truncate block">{v?.name ?? "Varian"}</span>
                        <span className="text-[10px] text-[#65676B] font-mono">{v?.code}</span>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <input
                          placeholder="Size"
                          value={line.size}
                          onChange={(e) => handleUpdateLine(idx, { size: e.target.value })}
                          className={UNIFORM_INPUT_CLS}
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={line.quantityOrdered || ""}
                          onChange={(e) =>
                            handleUpdateLine(idx, { quantityOrdered: Math.max(0, parseInt(e.target.value) || 0) })
                          }
                          className={`${UNIFORM_INPUT_CLS} ${line.quantityOrdered <= 0 ? "border-rose-500" : ""}`}
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-3">
                        <input
                          type="number"
                          placeholder="Harga Satuan"
                          value={line.unitPrice || ""}
                          onChange={(e) =>
                            handleUpdateLine(idx, { unitPrice: Math.max(0, parseInt(e.target.value) || 0) })
                          }
                          className={UNIFORM_INPUT_CLS}
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 text-[#65676B] hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#E7F3FF]/40 border border-[#1877F2]/20">
                  <span className="text-xs font-semibold text-[#050505]">Estimasi Total PO:</span>
                  <span className="text-sm font-bold text-[#1877F2]">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E4E6EB] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#CED0D4] rounded-xl text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {busy ? "Menyimpan..." : "Terbitkan PO"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
