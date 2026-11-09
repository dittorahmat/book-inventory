import { useEffect, useState } from "react";
import { Plus, Building2, Search, PackageCheck } from "lucide-react";
import { CreateSupplierModal } from "../procurement/CreateSupplierModal";
import { CreateUniformPoModal } from "./CreateUniformPoModal";
import { getJson } from "../../lib/api";
import { formatRupiah } from "../../lib/transfer-pricing";
import {
  fetchUniformVariants,
  fetchUniformPos,
  createUniformPo,
  receiveUniformPo,
  type UniformVariantRow,
} from "./uniform-admin-api";

export function UniformProcurementSection() {
  const [variants, setVariants] = useState<UniformVariantRow[]>([]);
  const [pos, setPos] = useState<Array<{ id: string; poNumber: string; status: string; totalAmount: number; supplierName?: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Receiving state dialog
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null);
  const [receiveLines, setReceiveLines] = useState<Array<{ variantId: string; size: string; qty: string }>>([]);

  const reload = async () => {
    try {
      const [v, o, s] = await Promise.all([
        fetchUniformVariants(),
        fetchUniformPos(),
        getJson<Array<{ id: string; name: string }>>("/api/procurement/suppliers?type=uniform", "Gagal memuat supplier konveksi."),
      ]);
      setVariants(Array.isArray(v) ? v : []);
      setPos(Array.isArray(o) ? o : []);
      setSuppliers(Array.isArray(s) ? s : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data PO konveksi.");
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(okMsg);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operasi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const filteredPos = pos.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.poNumber.toLowerCase().includes(q) ||
      p.status.toLowerCase().includes(q) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{notice}</div>}

      {/* Editorial Header Section */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E4E6EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
              Inbound Procurement
            </span>
            <span className="text-xs text-[#65676B]">&bull; Gudang Seragam</span>
          </div>
          <h2 className="text-xl font-bold text-[#050505] tracking-tight mt-1">
            PO ke Konveksi & Penerimaan Bahan
          </h2>
          <p className="text-xs text-[#65676B] max-w-2xl mt-0.5">
            Kelola pesanan produksi bahan/kain atau set seragam jadi ke mitra konveksi supplier, dan catat penerimaan fisik barang masuk langsung ke stok gudang.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] text-[#050505] font-semibold text-xs transition-colors flex items-center gap-1.5 active:scale-[0.98] shadow-2xs"
          >
            <Building2 className="w-3.5 h-3.5 text-[#65676B]" />
            <span>Tambah Konveksi</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreatePoModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs transition-colors shadow-2xs flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Buat PO Baru</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
        <input
          type="text"
          placeholder="Cari Purchase Order berdasarkan no. PO, status, atau supplier..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] placeholder-[#65676B] focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] shadow-2xs transition-all"
        />
      </div>

      {/* Tabel Purchase Orders (Desktop) + Mobile Cards */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-[#F0F2F5]/60 flex items-center justify-between text-xs font-bold text-[#65676B] border-b border-[#E4E6EB]">
          <span>Daftar Purchase Order ({filteredPos.length} ditemukan)</span>
          <span>Status & Aksi</span>
        </div>

        {filteredPos.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-[#65676B]">
            <PackageCheck className="w-8 h-8 mx-auto mb-2 text-[#CED0D4]" />
            {pos.length === 0
              ? 'Belum ada Purchase Order konveksi. Klik "+ Buat PO Konveksi Baru" di atas.'
              : "Tidak ada Purchase Order yang cocok dengan filter pencarian."}
          </div>
        ) : (
          <div className="divide-y divide-[#E4E6EB]">
            {filteredPos.map((p) => {
              const isReceiving = receivingPoId === p.id;
              return (
                <div key={p.id} className="p-4 text-xs hover:bg-[#F0F2F5]/40 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-[#050505]">{p.poNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : p.status === "partially_received"
                              ? "bg-blue-50 text-[#1877F2] border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {p.status === "completed"
                            ? "Selesai"
                            : p.status === "partially_received"
                            ? "Diterima Sebagian"
                            : "Menunggu / Draft"}
                        </span>
                      </div>
                      <div className="text-[#65676B] flex items-center gap-2 flex-wrap">
                        <span>Total PO: <strong className="text-[#1877F2]">{formatRupiah(p.totalAmount)}</strong></span>
                        {p.supplierName && <span>&bull; Mitra: {p.supplierName}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(p.status === "draft" || p.status === "partially_received") && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (isReceiving) {
                              setReceivingPoId(null);
                            } else {
                              setReceivingPoId(p.id);
                              setReceiveLines([{ variantId: variants[0]?.variant.id ?? "", size: "", qty: "1" }]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-[0.98] ${
                            isReceiving
                              ? "bg-[#E7F3FF] border-[#1877F2] text-[#1877F2]"
                              : "bg-white border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                          }`}
                        >
                          {isReceiving ? "Tutup Penerimaan" : "Catat Penerimaan Fisik"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Drawer Panel Penerimaan Fisik */}
                  {isReceiving && (
                    <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#1877F2]/30 space-y-3 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#050505]">Input Kuantitas Barang Masuk (Inbound):</span>
                        <button
                          type="button"
                          onClick={() =>
                            setReceiveLines((prev) => [
                              ...prev,
                              { variantId: variants[0]?.variant.id ?? "", size: "", qty: "1" },
                            ])
                          }
                          className="text-[11px] font-bold text-[#1877F2] hover:underline"
                        >
                          + Tambah Baris
                        </button>
                      </div>

                      <div className="space-y-2">
                        {receiveLines.map((line, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-6">
                              <select
                                value={line.variantId}
                                onChange={(e) =>
                                  setReceiveLines((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, variantId: e.target.value } : x))
                                  )
                                }
                                className="w-full rounded-lg border border-[#CED0D4] px-2 py-1.5 text-xs bg-white"
                              >
                                {variants.map(({ variant: v }) => (
                                  <option key={v.id} value={v.id}>
                                    {v.code} — {v.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-3">
                              <input
                                placeholder="Size (S/M/..)"
                                value={line.size}
                                onChange={(e) =>
                                  setReceiveLines((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, size: e.target.value } : x))
                                  )
                                }
                                className="w-full rounded-lg border border-[#CED0D4] px-2 py-1.5 text-xs bg-white"
                              />
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                placeholder="Qty"
                                min="1"
                                value={line.qty}
                                onChange={(e) =>
                                  setReceiveLines((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x))
                                  )
                                }
                                className="w-full rounded-lg border border-[#CED0D4] px-2 py-1.5 text-xs bg-white font-bold"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-[#E4E6EB]">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const validLines = receiveLines
                              .filter((l) => Number(l.qty) > 0)
                              .map((l) => ({
                                variantId: l.variantId,
                                size: l.size.trim() || undefined,
                                quantity: Number(l.qty) || 0,
                              }));
                            if (validLines.length === 0) {
                              setError("Isi minimal satu baris kuantitas barang yang diterima.");
                              return;
                            }
                            run(
                              () => receiveUniformPo(p.id, validLines).then(() => setReceivingPoId(null)),
                              "Penerimaan barang PO berhasil dicatat ke stok gudang."
                            );
                          }}
                          className="px-4 py-1.5 bg-[#1877F2] text-white rounded-lg text-xs font-semibold hover:bg-[#1664D9] disabled:opacity-50"
                        >
                          Simpan Penerimaan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah Supplier / Mitra Konveksi */}
      {isSupplierModalOpen && (
        <CreateSupplierModal
          title="Tambah Mitra Konveksi Baru"
          defaultType="uniform"
          codePlaceholder="mis. KNV-BDG, JKT-JAYA"
          namePlaceholder="mis. CV Konveksi Mandiri"
          onClose={() => setIsSupplierModalOpen(false)}
          onCreated={async () => {
            setIsSupplierModalOpen(false);
            await reload();
          }}
        />
      )}

      {/* Modal Buat Purchase Order Baru */}
      <CreateUniformPoModal
        isOpen={isCreatePoModalOpen}
        suppliers={suppliers}
        variants={variants}
        busy={busy}
        onClose={() => setIsCreatePoModalOpen(false)}
        onSubmit={async (payload) => {
          await run(() => createUniformPo(payload), "Purchase Order konveksi berhasil diterbitkan.");
          setIsCreatePoModalOpen(false);
        }}
        onOpenSupplierModal={() => setIsSupplierModalOpen(true)}
      />
    </div>
  );
}
