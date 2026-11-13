import { useMemo, useRef, useState } from "react";
import { Plus, X, AlertCircle } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { formatRupiah } from "../../lib/transfer-pricing";
import { UNIFORM_LABEL_CLS } from "./uniform-styles";
import type { UniformVariantRow } from "./uniform-admin-api";
import { UniformPoPickerSection } from "./UniformPoPickerSection";
import { UniformPoItemCard, getItemTotalQty, type MatrixPoItem } from "./UniformPoItemCard";

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
  const [items, setItems] = useState<MatrixPoItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [highlightedVariantId, setHighlightedVariantId] = useState<string | null>(null);

  // Filter & Search picker state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJenjang, setSelectedJenjang] = useState("ALL");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const supplierRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedVariantIds = useMemo(() => new Set(items.map((it) => it.variantId)), [items]);

  const filteredAvailableVariants = useMemo(() => {
    return variants.filter(({ variant: v }) => {
      if (selectedJenjang !== "ALL" && v.jenjang.toUpperCase() !== selectedJenjang) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const matchName = v.name.toLowerCase().includes(term);
      const matchCode = v.code.toLowerCase().includes(term);
      const matchKind = v.kind.toLowerCase().includes(term);
      return matchName || matchCode || matchKind;
    });
  }, [variants, selectedJenjang, searchTerm]);

  if (!isOpen) return null;

  const handleSelectItem = (variantId: string) => {
    const vRow = variants.find((x) => x.variant.id === variantId);
    if (!vRow) return;

    if (selectedVariantIds.has(variantId)) {
      setHighlightedVariantId(variantId);
      setTimeout(() => setHighlightedVariantId(null), 2000);
      setSearchTerm("");
      setIsPickerOpen(false);
      return;
    }

    const initialSizeQty: Record<string, number> = {};
    const validSizes = vRow.sizes && vRow.sizes.length > 0 ? vRow.sizes : [];
    if (validSizes.length > 0) {
      validSizes.forEach((sz) => {
        initialSizeQty[sz] = 0;
      });
    }

    setItems((prev) => [
      ...prev,
      {
        variantId: vRow.variant.id,
        unitPrice: vRow.variant.price || 0,
        sizeQuantities: initialSizeQty,
        singleQuantity: validSizes.length === 0 ? 10 : 0,
      },
    ]);

    setSearchTerm("");
    setIsPickerOpen(false);
    if (fieldErrors.lines) {
      setFieldErrors((prev) => ({ ...prev, lines: undefined }));
    }
  };

  const handleRemoveItem = (variantId: string) => {
    setItems((prev) => prev.filter((it) => it.variantId !== variantId));
  };

  const handleUpdatePrice = (variantId: string, unitPrice: number) => {
    setItems((prev) =>
      prev.map((it) => (it.variantId === variantId ? { ...it, unitPrice: Math.max(0, unitPrice) } : it))
    );
  };

  const handleUpdateSizeQty = (variantId: string, size: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.variantId !== variantId) return it;
        return {
          ...it,
          sizeQuantities: {
            ...it.sizeQuantities,
            [size]: Math.max(0, qty),
          },
        };
      })
    );
  };

  const handleUpdateSingleQty = (variantId: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) => (it.variantId === variantId ? { ...it, singleQuantity: Math.max(0, qty) } : it))
    );
  };

  const grandTotal = items.reduce((acc, it) => {
    const vRow = variants.find((x) => x.variant.id === it.variantId);
    const hasSizes = (vRow?.sizes?.length ?? 0) > 0;
    const totalQty = getItemTotalQty(it, hasSizes);
    return acc + totalQty * (it.unitPrice || 0);
  }, 0);

  const grandTotalPcs = items.reduce((acc, it) => {
    const vRow = variants.find((x) => x.variant.id === it.variantId);
    const hasSizes = (vRow?.sizes?.length ?? 0) > 0;
    return acc + getItemTotalQty(it, hasSizes);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string | undefined> = {};

    if (!poSupplier) {
      errors.supplier = "Pilih mitra konveksi / supplier terlebih dahulu.";
    }

    if (items.length === 0) {
      errors.lines = "Tambahkan minimal 1 item varian seragam ke PO.";
    }

    const flattenedLines: Array<{
      variantId: string;
      size?: string;
      quantityOrdered: number;
      unitPrice: number;
    }> = [];

    let hasZeroQtyItem = false;

    for (const it of items) {
      const vRow = variants.find((x) => x.variant.id === it.variantId);
      const validSizes = vRow?.sizes && vRow.sizes.length > 0 ? vRow.sizes : [];

      if (validSizes.length > 0) {
        let itemTotalQty = 0;
        for (const sz of validSizes) {
          const qty = it.sizeQuantities[sz] || 0;
          if (qty > 0) {
            itemTotalQty += qty;
            flattenedLines.push({
              variantId: it.variantId,
              size: sz,
              quantityOrdered: qty,
              unitPrice: it.unitPrice,
            });
          }
        }
        if (itemTotalQty === 0) {
          hasZeroQtyItem = true;
        }
      } else {
        if (!it.singleQuantity || it.singleQuantity <= 0) {
          hasZeroQtyItem = true;
        } else {
          flattenedLines.push({
            variantId: it.variantId,
            quantityOrdered: it.singleQuantity,
            unitPrice: it.unitPrice,
          });
        }
      }
    }

    if (hasZeroQtyItem) {
      errors.quantity = "Setiap seragam yang dipilih wajib diisi kuantitasnya minimal 1 pcs pada salah satu ukuran.";
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
      lines: flattenedLines,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E4E6EB] bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-base font-bold text-[#050505]">Buat PO Konveksi Baru</h3>
            <p className="text-xs text-[#65676B] mt-0.5">
              Terbitkan Purchase Order produksi bahan/kain atau set seragam ke mitra konveksi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          <FormSummaryAlert errors={fieldErrors} title="Formulir PO Belum Lengkap" />

          {/* Supplier Picker */}
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
                placeholder={
                  suppliers.length === 0
                    ? "Belum ada mitra konveksi (Klik Tambah Baru)"
                    : "— Pilih mitra konveksi —"
                }
              />
            </div>
            <FormFieldFeedback error={fieldErrors.supplier} />
          </div>

          {/* Search Combobox & Quick Filter */}
          <UniformPoPickerSection
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedJenjang={selectedJenjang}
            setSelectedJenjang={setSelectedJenjang}
            isPickerOpen={isPickerOpen}
            setIsPickerOpen={setIsPickerOpen}
            filteredVariants={filteredAvailableVariants}
            selectedVariantIds={selectedVariantIds}
            onSelectItem={handleSelectItem}
            inputRef={searchInputRef}
          />

          {/* Rincian Item Pesanan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={UNIFORM_LABEL_CLS}>
                Rincian Item Pesanan PO ({items.length} Model, Total {grandTotalPcs} Pcs):
              </label>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-[11px] font-medium text-rose-600 hover:underline"
                >
                  Hapus Semua
                </button>
              )}
            </div>

            <FormFieldFeedback error={fieldErrors.lines || fieldErrors.quantity} />

            {items.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#65676B] border border-dashed border-[#CED0D4] rounded-2xl bg-[#FAFAFA]">
                <AlertCircle className="w-6 h-6 mx-auto mb-1.5 text-[#65676B]/60" />
                Belum ada seragam yang dipilih. Gunakan kotak pencarian di atas untuk memasukkan seragam ke PO.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => {
                  const vRow = variants.find((x) => x.variant.id === it.variantId);
                  return (
                    <UniformPoItemCard
                      key={it.variantId}
                      item={it}
                      variantRow={vRow}
                      isHighlighted={highlightedVariantId === it.variantId}
                      onUpdatePrice={handleUpdatePrice}
                      onUpdateSizeQty={handleUpdateSizeQty}
                      onUpdateSingleQty={handleUpdateSingleQty}
                      onRemoveItem={handleRemoveItem}
                    />
                  );
                })}

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#E7F3FF]/50 border border-[#1877F2]/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#050505]">Estimasi Total PO:</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#1877F2]/10 text-[#1877F2] text-[10px] font-bold">
                      {grandTotalPcs} Pcs
                    </span>
                  </div>
                  <span className="text-base font-extrabold text-[#1877F2]">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#E4E6EB] flex items-center justify-end gap-2 bg-white sticky bottom-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#CED0D4] rounded-xl text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy || items.length === 0}
              className="px-5 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] disabled:opacity-50 active:scale-[0.98] transition-all shadow-2xs"
            >
              {busy ? "Menyimpan..." : "Terbitkan PO"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
