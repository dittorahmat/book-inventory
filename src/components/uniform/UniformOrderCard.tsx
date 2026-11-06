import { useState, useRef, useEffect } from "react";
import { MoreVertical, Truck, FileText, CheckCircle, DollarSign, ExternalLink } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { UniformOrderRow } from "./uniform-admin-api";

interface UniformOrderCardProps {
  order: UniformOrderRow;
  shippingId: string | null;
  onShip: (id: string) => void;
  onOpenOngkir: (id: string, cost: number, resi: string) => void;
  onInvoice: (id: string, name: string) => void;
  onScholarship: (id: string, action: "approve" | "reject") => void;
  onReview: (order: UniformOrderRow) => void;
  onOpenPay: (id: string) => void;
}

export function UniformOrderCard({
  order: r,
  shippingId,
  onShip,
  onOpenOngkir,
  onInvoice,
  onScholarship,
  onReview,
  onOpenPay,
}: UniformOrderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F0F2F5]/30 transition-colors">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-[#050505]">{r.studentName}</span>
          <span className="text-xs font-mono text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-full border border-[#CED0D4]/60">
            {r.nis}
          </span>
          <span className="text-xs text-[#65676B]">· {r.orderNumber}</span>
          <span className="text-xs text-[#65676B]">· {r.schoolName}</span>
        </div>

        <div className="text-xs text-[#65676B] flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#050505]">{formatRupiah(r.totalAmount)}</span>
          <span>·</span>
          <span className="truncate max-w-xs">{r.homeAddressSnapshot || "Alamat belum diisi"}</span>
          <span>·</span>
          <span>Ongkir: {r.shippingCost ? formatRupiah(r.shippingCost) : "-"}</span>
          {r.shippingResi && <span>(Resi: {r.shippingResi})</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {r.shipmentStatus === "superseded" ? (
            <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
              Tertimpa (Superseded)
            </span>
          ) : r.shipmentStatus === "sudah_dikirim" ? (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              ✓ Terkirim{r.shippedAt ? ` · ${r.shippedAt.slice(0, 10)}` : ""}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              Belum terkirim
            </span>
          )}

          {r.stage && (
            <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full">
              {r.stage === "pemesanan"
                ? "Pemesanan"
                : r.stage === "tagihan"
                ? "Tagihan masuk"
                : r.stage === "konfirmasi"
                ? "Konfirmasi bayar"
                : "Lunas"}
            </span>
          )}

          {r.orderType === "scholarship" && (
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
              Beasiswa
            </span>
          )}

          {(r.pendingCount ?? 0) > 0 && (
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
              Bukti bayar menunggu ({r.pendingCount})
            </span>
          )}
        </div>
      </div>

      {/* Action Section */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {r.shipmentStatus === "belum_dikirim" && (
          <button
            type="button"
            disabled={shippingId === r.id}
            onClick={() => onShip(r.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98] transition-all shadow-xs"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>{shippingId === r.id ? "Memproses…" : "Tandai Kirim"}</span>
          </button>
        )}

        {(r.pendingCount ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => onReview(r)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold hover:bg-amber-100 active:scale-[0.98] transition-all"
          >
            <span>Verifikasi ({r.pendingCount})</span>
          </button>
        )}

        {/* Dropdown Menu untuk Aksi Sekunder */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-xl border border-[#CED0D4] bg-white text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5] transition-all active:scale-[0.98]"
            aria-label="Aksi lainnya"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl border border-[#E4E6EB] shadow-lg py-1 z-30 animate-fadeIn text-xs">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenOngkir(r.id, r.shippingCost ?? 0, r.shippingResi ?? "");
                }}
                className="w-full text-left px-3 py-2 text-[#050505] hover:bg-[#F0F2F5] flex items-center gap-2"
              >
                <Truck className="w-3.5 h-3.5 text-[#65676B]" />
                <span>Input Ongkir & Resi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onInvoice(r.id, r.studentName);
                }}
                className="w-full text-left px-3 py-2 text-[#050505] hover:bg-[#F0F2F5] flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-[#65676B]" />
                <span>{r.invoiceSentAt ? "Kirim Ulang Invoice WA" : "Kirim Invoice WA"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenPay(r.id);
                }}
                className="w-full text-left px-3 py-2 text-[#050505] hover:bg-[#F0F2F5] flex items-center gap-2 border-t border-[#E4E6EB]"
              >
                <DollarSign className="w-3.5 h-3.5 text-[#65676B]" />
                <span>Input Pembayaran Kasir</span>
              </button>

              {r.paymentStatus === "scholarship_pending" && (
                <div className="border-t border-[#E4E6EB] pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onScholarship(r.id, "approve");
                    }}
                    className="w-full text-left px-3 py-1.5 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Setujui Beasiswa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onScholarship(r.id, "reject");
                    }}
                    className="w-full text-left px-3 py-1.5 text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Tolak Beasiswa</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
