import { useEffect, useState } from "react";
import { SlidersHorizontal, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import {
  fetchUniformVariants,
  adjustUniformStock,
  fetchUniformRejects,
  createUniformReject,
  type UniformRejectRow,
  type UniformVariantRow,
} from "./uniform-admin-api";
import { EditUniformVariantModal } from "./EditUniformVariantModal";
import { UniformCatalogToolbar } from "./UniformCatalogToolbar";
import { CreateUniformVariantForm } from "./CreateUniformVariantForm";
import { UniformVariantList } from "./UniformVariantList";

const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white";
const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

export function UniformCatalogSection() {
  const [variants, setVariants] = useState<UniformVariantRow[]>([]);
  const [editingVariant, setEditingVariant] = useState<UniformVariantRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [activePanel, setActivePanel] = useState<"none" | "stock" | "reject">("none");

  const [stVariant, setStVariant] = useState("");
  const [stSize, setStSize] = useState("");
  const [stQty, setStQty] = useState("0");
  const [stMode, setStMode] = useState("add");
  const [stReason, setStReason] = useState("");
  const [stError, setStError] = useState<string | null>(null);
  const [rejects, setRejects] = useState<UniformRejectRow[]>([]);
  const [rjVariant, setRjVariant] = useState("");
  const [rjSize, setRjSize] = useState("");
  const [rjQty, setRjQty] = useState("1");
  const [rjReason, setRjReason] = useState("");
  const [rjError, setRjError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [v, r] = await Promise.all([
        fetchUniformVariants(),
        fetchUniformRejects().catch(() => [] as UniformRejectRow[]),
      ]);
      setVariants(v);
      setRejects(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data seragam.");
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

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}

      {/* Toolbar Katalog Seragam */}
      <UniformCatalogToolbar
        totalCount={variants.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showForm={showAddForm}
        onToggleForm={() => setShowAddForm((prev) => !prev)}
      />

      {/* Form Tambah Varian */}
      {showAddForm && (
        <CreateUniformVariantForm
          busy={busy}
          onSuccess={(msg) => {
            setNotice(msg);
            setShowAddForm(false);
            reload();
          }}
          onError={setError}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Sub-toolbar opsi operasional: Stok Manual & Catatan Reject */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 px-4 rounded-xl border border-[#E4E6EB] shadow-2xs">
        <div className="text-xs text-[#65676B]">
          Operasi Gudang Tambahan:
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActivePanel((prev) => (prev === "stock" ? "none" : "stock"))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-[0.98] ${
              activePanel === "stock"
                ? "bg-[#E7F3FF] border-[#1877F2] text-[#1877F2]"
                : "bg-white border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Stok Manual / Opname</span>
            {activePanel === "stock" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setActivePanel((prev) => (prev === "reject" ? "none" : "reject"))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-[0.98] ${
              activePanel === "reject"
                ? "bg-rose-50 border-rose-300 text-rose-700"
                : "bg-white border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Catatan Reject ({rejects.length})</span>
            {activePanel === "reject" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Panel 1: Penyesuaian Stok Manual */}
      {activePanel === "stock" && (
        <div className="bg-white rounded-2xl border border-[#1877F2]/30 p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Stok Manual (Awal / Masuk)</h3>
              <p className="text-xs text-[#65676B] mt-0.5">Catat saldo stok awal atau penambahan fisik dari pihak ketiga.</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel("none")}
              className="text-xs font-medium text-[#65676B] hover:text-[#050505] px-2 py-1 rounded"
            >
              Tutup
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <SearchableSingleSelect
                label="Varian"
                options={variants.map(({ variant: v }) => ({ value: v.id, label: `${v.code} — ${v.name}` }))}
                value={stVariant}
                onChange={setStVariant}
                placeholder="— Pilih varian —"
              />
            </div>
            <div>
              <label className={labelCls}>Size (kosongkan untuk kain)</label>
              <input value={stSize} onChange={(e) => setStSize(e.target.value)} placeholder="S / M / ..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Qty</label>
              <input value={stQty} inputMode="numeric" onChange={(e) => setStQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <SearchableSingleSelect
                label="Mode"
                options={[
                  { value: "add", label: "Tambah (stok masuk)" },
                  { value: "set", label: "Set (stok awal/opname)" },
                ]}
                value={stMode}
                onChange={setStMode}
                placeholder="Pilih mode..."
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Alasan (wajib)</label>
            <input value={stReason} onChange={(e) => { setStReason(e.target.value); setStError(null); }} placeholder="Stok awal / kiriman konveksi ..." className={inputCls} />
          </div>
          {stError && <p className="text-xs text-rose-600 font-medium">{stError}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!stVariant) {
                setStError("Pilih varian seragam terlebih dahulu.");
                return;
              }
              if (!stReason.trim()) {
                setStError("Alasan penyesuaian stok wajib diisi.");
                return;
              }
              setStError(null);
              run(
                () =>
                  adjustUniformStock({
                    variantId: stVariant,
                    size: stSize.trim() || undefined,
                    quantity: Number(stQty) || 0,
                    mode: stMode as "add" | "set",
                    reason: stReason.trim(),
                  }),
                "Stok disesuaikan."
              );
            }}
            className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98] transition-colors"
          >
            Simpan Stok
          </button>
        </div>
      )}

      {/* Collapsible Panel 2: Catatan Barang Reject */}
      {activePanel === "reject" && (
        <div className="bg-white rounded-2xl border border-rose-300 p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Catatan Barang Reject</h3>
              <p className="text-xs text-[#65676B] mt-0.5">Dokumentasi kain atau seragam cacat dari konveksi/gudang.</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel("none")}
              className="text-xs font-medium text-[#65676B] hover:text-[#050505] px-2 py-1 rounded"
            >
              Tutup
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <SearchableSingleSelect
                label="Varian"
                options={variants.map(({ variant: v }) => ({ value: v.id, label: `${v.code} — ${v.name}` }))}
                value={rjVariant}
                onChange={setRjVariant}
                placeholder="— Pilih varian —"
              />
            </div>
            <div>
              <label className={labelCls}>Size (kosongkan untuk kain)</label>
              <input value={rjSize} onChange={(e) => setRjSize(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Qty reject</label>
              <input value={rjQty} inputMode="numeric" onChange={(e) => setRjQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Alasan</label>
              <input value={rjReason} onChange={(e) => { setRjReason(e.target.value); setRjError(null); }} placeholder="Cacat / salah jahit ..." className={inputCls} />
            </div>
          </div>
          {rjError && <p className="text-xs text-rose-600 font-medium">{rjError}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!rjVariant) {
                setRjError("Pilih varian seragam terlebih dahulu.");
                return;
              }
              if (!rjReason.trim()) {
                setRjError("Alasan reject wajib diisi.");
                return;
              }
              setRjError(null);
              run(
                () =>
                  createUniformReject({
                    variantId: rjVariant,
                    size: rjSize.trim() || undefined,
                    quantity: Number(rjQty) || 0,
                    reason: rjReason.trim(),
                  }),
                "Reject tercatat."
              );
            }}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 active:scale-[0.98] transition-colors"
          >
            Catat Reject
          </button>
          <div className="divide-y divide-[#E4E6EB] rounded-xl border border-[#E4E6EB] overflow-hidden">
            {rejects.length === 0 && <div className="px-4 py-4 text-xs text-[#65676B]">Belum ada catatan reject.</div>}
            {rejects.slice(0, 20).map((r) => (
              <div key={r.id} className="px-4 py-2.5 text-xs flex items-center justify-between gap-2 hover:bg-[#F0F2F5]/50">
                <span className="font-semibold">{r.size || "-"} × {r.quantity} — {r.reason}</span>
                <span className="text-[#65676B]">{r.createdAt.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List Varian Seragam (Tabel Desktop + Card Mobile) */}
      <UniformVariantList
        variants={variants}
        searchQuery={searchQuery}
        onEdit={(row) => setEditingVariant(row)}
      />

      {editingVariant && (
        <EditUniformVariantModal
          variantRow={editingVariant}
          isOpen={true}
          onClose={() => setEditingVariant(null)}
          onSuccess={() => {
            setNotice("Varian berhasil diperbarui.");
            reload();
          }}
        />
      )}
    </div>
  );
}
