import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, RefreshCw, Search, Truck } from "lucide-react";
import { School } from "../types";
import type { StockOverviewPayload } from "../types/stock-summary";
import { StockSummaryTable } from "../components/inventory/StockSummaryTable";
import { QuantityTransferModal, type TransferLinePreview } from "../components/inventory/QuantityTransferModal";
import { PhysicalDrilldown } from "../components/inventory/PhysicalDrilldown";
import { formatRupiah } from "../lib/transfer-pricing";
import { buildQuery, getJson } from "../lib/api";

interface InventoryViewProps {
  activeSchool: School | null;
  /** Peran pengguna; drill-down fisik hanya untuk gudang & central. */
  role?: string;
}

/** Peran yang boleh melihat identitas fisik per barcode (audit). */
function canDrilldown(role: string | undefined): boolean {
  return role === "central_admin" || role === "warehouse_admin";
}

export function InventoryView({ activeSchool, role }: InventoryViewProps) {
  const [overview, setOverview] = useState<StockOverviewPayload | null>(null);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<{ open: boolean; bookId?: string }>({ open: false });

  const loadOverview = useCallback(async () => {
    if (!activeSchool) return;
    setIsLoading(true);
    setError(null);
    try {
      const rows = await getJson<StockOverviewPayload[]>(
        buildQuery("/api/stock-summary/overview", { schoolId: activeSchool.id }),
        "Gagal memuat ringkasan stok."
      );
      const row: StockOverviewPayload | undefined = rows.find((r) => r.schoolId === activeSchool.id);
      setOverview(
        row ?? {
          schoolId: activeSchool.id,
          looseTitleCount: 0,
          looseTotalQty: 0,
          looseAvailableQty: 0,
          packageTypeCount: 0,
          packageTotalQty: 0,
          packageReadyQty: 0,
          loose: [],
          packages: [],
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat ringkasan stok.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSchool]);

  useEffect(() => {
    loadOverview();
    setQuantities({});
  }, [loadOverview]);

  useEffect(() => {
    getJson<School[]>("/api/schools", "Gagal memuat daftar sekolah.")
      .then(setAllSchools)
      .catch(() => setAllSchools([]));
  }, []);

  const looseRows = useMemo(() => {
    const rows = overview?.loose ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(q) || r.isbn.toLowerCase().includes(q));
  }, [overview, search]);

  const packageRows = useMemo(() => {
    const rows = overview?.packages ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [overview, search]);

  const transferLines = useMemo<TransferLinePreview[]>(() => {
    const lines: TransferLinePreview[] = [];
    for (const [key, quantity] of Object.entries(quantities)) {
      if (!quantity || quantity <= 0) continue;
      const [kind, id] = key.split(":");
      if (kind === "loose") {
        const row = looseRows.find((r) => r.bookId === id);
        if (row) lines.push({ key, label: row.title, quantity, unitPrice: row.sellPrice });
      } else {
        const row = packageRows.find((r) => r.packageId === id);
        if (row) lines.push({ key, label: row.name, quantity, unitPrice: row.price });
      }
    }
    return lines;
  }, [quantities, looseRows, packageRows]);

  const totalTransferQty = transferLines.reduce((s, l) => s + l.quantity, 0);
  const totalTransferValue = transferLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E6EB] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-[#050505] flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#1877F2]" />
            Ringkasan Stok
          </h2>
          <p className="text-xs text-[#65676B] mt-0.5">
            Stok di{" "}
            <span className="font-semibold text-[#050505]">{activeSchool ? activeSchool.name : "..."}</span> &bull;{" "}
            {overview?.looseAvailableQty ?? 0} satuan tersedia dari {overview?.looseTitleCount ?? 0} judul &bull;{" "}
            {overview?.packageReadyQty ?? 0} paket siap
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
            <input
              type="text"
              placeholder="Cari judul atau kode paket..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs font-medium border border-[#CED0D4] rounded-lg bg-white text-[#050505] w-full sm:w-64 focus:outline-hidden focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all placeholder-[#8A8D91]"
            />
          </div>
          <button
            type="button"
            onClick={loadOverview}
            title="Muat ulang ringkasan"
            className="p-2.5 rounded-lg border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>
      )}

      {totalTransferQty > 0 && (
        <div className="sticky top-2 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white rounded-2xl shadow-lg border border-[#CED0D4]">
          <div className="text-xs text-[#050505]">
            <span className="font-bold">{totalTransferQty} unit</span> dari {transferLines.length} baris
            dipindahkan &bull; nilai estimasi{" "}
            <span className="font-bold text-[#1877F2]">{formatRupiah(totalTransferValue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantities({})}
              className="px-3.5 py-2 rounded-xl bg-[#F0F2F5] hover:bg-[#E4E6EB] font-semibold text-[#65676B] text-xs transition-colors active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => setIsTransferOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 active:scale-[0.98]"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Buat Transfer</span>
            </button>
          </div>
        </div>
      )}

      <StockSummaryTable
        looseRows={looseRows}
        packageRows={packageRows}
        quantities={quantities}
        onQuantityChange={(key, value) => setQuantities((prev) => ({ ...prev, [key]: value }))}
        canDrilldown={canDrilldown(role)}
        onDrilldown={(bookId) => setDrilldown({ open: true, bookId })}
      />

      <QuantityTransferModal
        open={isTransferOpen}
        fromSchool={activeSchool}
        destinations={allSchools}
        lines={transferLines}
        onClose={() => setIsTransferOpen(false)}
        onCreated={() => {
          setQuantities({});
          loadOverview();
        }}
      />

      {activeSchool && (
        <PhysicalDrilldown
          open={drilldown.open}
          schoolId={activeSchool.id}
          bookId={drilldown.bookId}
          onClose={() => setDrilldown({ open: false })}
        />
      )}
    </div>
  );
}
