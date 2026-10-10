import { useState } from "react";
import { ChevronDown, Truck } from "lucide-react";
import type { InternalOrder, InternalShipment } from "../../lib/internal-orders-types";
import { ipoProgress, ipoStatusLabel } from "../../lib/internal-orders-types";

interface InternalOrdersTableProps {
  orders: InternalOrder[];
  isLoading: boolean;
  shipmentsByOrder: Record<string, InternalShipment[]>;
  shipmentsLoading: Record<string, boolean>;
  shipmentsError: Record<string, string | null>;
  onToggleShipments: (orderId: string, expanded: boolean) => void;
}

const statusTone = (status: string): string =>
  status === "completed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "partial_fulfilled"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-[#E7F3FF] text-[#1877F2] border-[#1877F2]/20";

function ShipmentHistory({
  shipments,
  isLoading,
  error,
  onRetry,
}: {
  shipments: InternalShipment[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 py-2" aria-label="Memuat riwayat pengiriman">
        {[0, 1].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-xl bg-[#F0F2F5]" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        <span>{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 font-semibold hover:bg-red-100/50 active:scale-[0.98]"
        >
          Coba Lagi
        </button>
      </div>
    );
  }
  if (shipments.length === 0) {
    return (
      <p className="py-2 text-xs text-[#65676B]">
        Belum ada pengiriman dari gudang untuk pesanan ini. Pantau kembali setelah gudang menerbitkan surat jalan.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[#E4E6EB]">
      {shipments.map((s) => (
        <li key={s.id} className="py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Truck className="h-3.5 w-3.5 text-[#65676B]" />
            <span className="font-bold text-[#050505]">{s.deliveryNoteNumber}</span>
            <span className="text-[#65676B]">{s.shippedDate ?? s.createdAt.slice(0, 10)}</span>
            <span className="font-semibold text-emerald-700">{s.status}</span>
          </div>
          <p className="mt-1 text-xs text-[#050505]">
            {s.items.map((i) => `${i.packageName ?? i.bookTitle ?? "Item"} × ${i.quantity}`).join(" · ") || "—"}
          </p>
          {s.notes && <p className="mt-0.5 text-xs text-[#65676B]">{s.notes}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Daftar IPO cabang: nomor, status, item, progres pemenuhan + riwayat pengiriman. */
export function InternalOrdersTable({
  orders,
  isLoading,
  shipmentsByOrder,
  shipmentsLoading,
  shipmentsError,
  onToggleShipments,
}: InternalOrdersTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2.5 rounded-2xl border border-[#E4E6EB] bg-white p-4" aria-label="Memuat pesanan">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F0F2F5]" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E4E6EB] bg-white p-8 text-center">
        <p className="text-sm font-bold text-[#050505]">Belum ada pesanan ke gudang</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-[#65676B]">
          Buat pesanan paket pertama lewat tombol “Buat Pesanan” — gudang pusat akan memenuhi dan Anda bisa memantau
          progres serta surat jalannya di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E4E6EB] bg-white">
      <ul className="divide-y divide-[#E4E6EB]">
        {orders.map((order) => {
          const progress = ipoProgress(order);
          const expanded = expandedId === order.id;
          return (
            <li key={order.id} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-sm font-bold text-[#050505]">{order.poNumber}</span>
                <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${statusTone(order.status)}`}>
                  {ipoStatusLabel(order.status)}
                </span>
                <span className="text-xs text-[#65676B]">{order.schoolName}</span>
                <span className="ml-auto text-xs font-semibold text-[#050505]">
                  {progress.fulfilled}/{progress.ordered} paket ({progress.percent}%)
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F0F2F5]" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-[#050505]">
                {order.items.map((i) => `${i.packageName} × ${i.quantityOrdered}`).join(" · ")}
              </p>
              {order.notes && <p className="mt-0.5 text-xs text-[#65676B]">{order.notes}</p>}
              <button
                type="button"
                onClick={() => {
                  const next = expanded ? null : order.id;
                  setExpandedId(next);
                  onToggleShipments(order.id, !expanded);
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#1877F2] hover:underline active:scale-[0.98]"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Sembunyikan pengiriman" : "Lihat riwayat pengiriman"}
              </button>
              {expanded && (
                <div className="mt-2 rounded-xl border border-[#E4E6EB] bg-[#F8F9FA] px-3 py-1.5">
                  <ShipmentHistory
                    shipments={shipmentsByOrder[order.id] ?? []}
                    isLoading={!!shipmentsLoading[order.id]}
                    error={shipmentsError[order.id] ?? null}
                    onRetry={() => onToggleShipments(order.id, true)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
