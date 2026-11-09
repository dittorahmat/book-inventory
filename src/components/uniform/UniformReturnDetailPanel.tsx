import { useState } from "react";
import { ArrowLeftRight, RotateCcw, X } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { UniformOrderDetail } from "./uniform-admin-api";

interface UniformReturnDetailPanelProps {
  detail: UniformOrderDetail;
  variantNames: Record<string, string>;
  packageNames: Record<string, string>;
  olahraga: Array<{ id: string; name: string; sizes: string[] }>;
  busy: boolean;
  onClose: () => void;
  onRequestExchange: (params: {
    oldVariantId?: string;
    oldSize?: string;
    newVariantId: string;
    newSize: string;
    reason: string;
  }) => Promise<void>;
  onRequestRefund: (params: { amount?: number; reason: string }) => Promise<void>;
}

import { UNIFORM_INPUT_CLS, UNIFORM_LABEL_CLS } from "./uniform-styles";

export function UniformReturnDetailPanel({
  detail,
  variantNames,
  packageNames,
  olahraga,
  busy,
  onClose,
  onRequestExchange,
  onRequestRefund,
}: UniformReturnDetailPanelProps) {
  const [exItem, setExItem] = useState("");
  const [exNewVariant, setExNewVariant] = useState("");
  const [exNewSize, setExNewSize] = useState("");
  const [exReason, setExReason] = useState("");
  const [rfAmount, setRfAmount] = useState("");
  const [rfReason, setRfReason] = useState("");

  const itemLabel = (i: UniformOrderDetail["items"][number]) =>
    i.variantId
      ? `${variantNames[i.variantId] ?? i.variantId} · ${i.size} ×${i.quantity}`
      : `${packageNames[i.packageId ?? ""] ?? i.packageId} ×${i.quantity}`;

  const selectedItem = detail.items.find((i) => i.id === exItem) ?? null;

  return (
    <div className="bg-white rounded-2xl border border-[#1877F2]/40 p-4 sm:p-5 space-y-4 shadow-xs animate-in fade-in duration-150">
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E4E6EB]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-base text-[#050505]">{detail.order.orderNumber}</span>
            <span className="text-xs font-semibold text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
              Detail Order
            </span>
          </div>
          <div className="text-xs text-[#65676B] mt-0.5">
            {detail.order.studentName} &bull; {detail.order.schoolName} &bull; Total:{" "}
            <strong className="text-[#050505]">{formatRupiah(detail.order.totalAmount)}</strong>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5] rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="text-xs text-[#65676B]">
        <span className="font-semibold text-[#050505]">Item Pesanan:</span> {detail.items.map(itemLabel).join(" · ")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 pt-2">
        <div className="rounded-xl border border-[#E4E6EB] p-4 space-y-3 bg-[#F8F9FA]">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#1877F2]" />
            <h4 className="text-xs font-bold text-[#050505]">Ajukan Tukar Ukuran (Olahraga &le;14 hari)</h4>
          </div>
          <div>
            <SearchableSingleSelect
              label="Item lama yang ditukar"
              options={detail.items.filter((i) => i.variantId).map((i) => ({ value: i.id, label: itemLabel(i) }))}
              value={exItem}
              onChange={setExItem}
              placeholder="— Pilih item —"
            />
          </div>
          <div>
            <SearchableSingleSelect
              label="Varian seragam baru"
              options={olahraga.map((v) => ({ value: v.id, label: v.name }))}
              value={exNewVariant}
              onChange={(v) => {
                setExNewVariant(v);
                setExNewSize("");
              }}
              placeholder="— Pilih varian —"
            />
          </div>
          <div>
            <SearchableSingleSelect
              label="Ukuran (size) baru"
              options={(olahraga.find((v) => v.id === exNewVariant)?.sizes ?? []).map((s) => ({ value: s, label: s }))}
              value={exNewSize}
              onChange={setExNewSize}
              placeholder="— Pilih size —"
            />
          </div>
          <div>
            <label className={UNIFORM_LABEL_CLS}>Alasan Penukaran</label>
            <input
              value={exReason}
              onChange={(e) => setExReason(e.target.value)}
              placeholder="mis. Ukuran kekecilan..."
              className={UNIFORM_INPUT_CLS}
            />
          </div>
          <button
            type="button"
            disabled={busy || !selectedItem?.variantId}
            onClick={() =>
              onRequestExchange({
                oldVariantId: selectedItem?.variantId ?? undefined,
                oldSize: selectedItem?.size ?? undefined,
                newVariantId: exNewVariant,
                newSize: exNewSize,
                reason: exReason,
              })
            }
            className="w-full px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98] transition-colors"
          >
            Ajukan Tukar Ukuran
          </button>
        </div>

        <div className="rounded-xl border border-[#E4E6EB] p-4 space-y-3 bg-[#F8F9FA]">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <h4 className="text-xs font-bold text-[#050505]">Ajukan Refund Dana</h4>
          </div>
          <div>
            <label className={UNIFORM_LABEL_CLS}>Nominal Refund (Maks: {formatRupiah(detail.order.totalAmount)})</label>
            <input
              value={rfAmount}
              inputMode="numeric"
              onChange={(e) => setRfAmount(e.target.value)}
              className={UNIFORM_INPUT_CLS}
              placeholder={String(detail.order.totalAmount)}
            />
          </div>
          <div>
            <label className={UNIFORM_LABEL_CLS}>Alasan Refund</label>
            <input
              value={rfReason}
              onChange={(e) => setRfReason(e.target.value)}
              placeholder="mis. Siswa mengundurkan diri..."
              className={UNIFORM_INPUT_CLS}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onRequestRefund({
                amount: rfAmount.trim() ? Number(rfAmount) : undefined,
                reason: rfReason,
              })
            }
            className="w-full px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-rose-700 active:scale-[0.98] transition-colors"
          >
            Ajukan Refund Dana
          </button>
        </div>
      </div>
    </div>
  );
}
