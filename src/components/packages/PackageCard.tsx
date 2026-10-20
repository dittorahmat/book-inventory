import { BookOpen, ChevronDown, ChevronUp, Layers, Package, Send, Trash2 } from "lucide-react";
import type { Book } from "../../types";
import type { StockPotential } from "../../types/stock-summary";
import { calcLooseOrderTotal, effectiveSellPrice } from "../../lib/book-pricing";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { PackageRow } from "./usePackagesData";

interface PackageCardProps {
  pkg: PackageRow;
  stock: StockPotential | undefined;
  catalogBooks: Book[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenBundling: (mode: "bundle" | "unbundle") => void;
  onOpenTransfer?: () => void;
  deletePackage: (packageId: string) => Promise<void>;
}

/** Satu kartu paket: identitas + metrik stok + aksi + akordeon BOM. View hanya orkestrasi. */
export function PackageCard({
  pkg,
  stock,
  catalogBooks,
  isExpanded,
  onToggleExpand,
  onOpenBundling,
  onOpenTransfer,
  deletePackage,
}: PackageCardProps) {
  const readyCount = stock?.readyBundleCount ?? 0;
  const potentialCount = stock?.maxPossibleBundles ?? 0;

  const handleDelete = async () => {
    const confirmMsg =
      readyCount > 0
        ? `Paket "${pkg.name}" memiliki ${readyCount} bundel siap serah. Menghapus paket akan otomatis membongkar seluruh bundel kembali menjadi buku satuan. Lanjutkan?`
        : `Hapus paket "${pkg.name}"?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await deletePackage(pkg.id);
      alert(`Paket "${pkg.name}" berhasil dihapus.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus paket.");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden transition-all">
      <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Package Identity */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              pkg.curriculumType === "international"
                ? "bg-[#E7F3FF] text-[#1877F2]"
                : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <Package className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-md">
                {pkg.code}
              </span>
              <span className="text-[11px] font-semibold text-[#1877F2]">
                Kelas {pkg.gradeLevel} &bull; {pkg.academicYear}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  pkg.curriculumType === "international"
                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {pkg.curriculumType}
              </span>
            </div>

            <h3 className="text-base font-bold text-[#050505] mt-1">{pkg.name}</h3>
            <p className="text-xs text-[#65676B] mt-0.5">
              Terdiri dari <span className="font-semibold text-[#050505]">{pkg.totalItemsCount} buku</span> berbeda
              &bull; Harga: <span className="font-semibold text-[#050505]">{formatRupiah(pkg.price)}</span>
            </p>
          </div>
        </div>

        {/* Stock Metrics and Actions */}
        <div className="flex flex-wrap items-center gap-4 lg:gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E4E6EB]">
          <div className="bg-[#F7F8FA] px-3.5 py-2 rounded-xl text-center min-w-[110px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#65676B] block">
              Siap Serah (Box)
            </span>
            <span className={`text-base font-bold ${readyCount > 0 ? "text-emerald-600" : "text-[#65676B]"}`}>
              {readyCount} Paket
            </span>
          </div>

          <div className="bg-[#F7F8FA] px-3.5 py-2 rounded-xl text-center min-w-[110px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#65676B] block">
              Potensi Rakit
            </span>
            <span className={`text-base font-bold ${potentialCount > 0 ? "text-[#1877F2]" : "text-amber-600"}`}>
              +{potentialCount} Paket
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenBundling("bundle")}
              disabled={potentialCount <= 0}
              className="px-3.5 py-2 bg-[#1877F2] text-white hover:bg-[#166FE5] disabled:bg-gray-200 disabled:text-gray-400 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 active:scale-[0.98]"
            >
              <Layers className="w-3.5 h-3.5" />
              Rakit Paket
            </button>

            <button
              onClick={() => onOpenBundling("unbundle")}
              disabled={readyCount <= 0}
              className="px-3 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] disabled:opacity-40 rounded-xl text-xs font-semibold transition-colors active:scale-[0.98]"
            >
              Bongkar
            </button>

            {onOpenTransfer && (
              <button
                onClick={onOpenTransfer}
                disabled={readyCount <= 0}
                title="Transfer bundel ready ke cabang lain"
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-40 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 active:scale-[0.98]"
              >
                <Send className="w-3.5 h-3.5" />
                Transfer
              </button>
            )}

            <button
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
              title={isExpanded ? "Sembunyikan rincian buku" : `Lihat rincian ${pkg.totalItemsCount} buku dalam paket`}
              className="px-3 py-2 rounded-xl border border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5] transition-colors flex items-center gap-1.5 text-xs font-semibold active:scale-[0.98]"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{isExpanded ? "Tutup" : `Lihat ${pkg.totalItemsCount} Buku`}</span>
            </button>

            <button
              onClick={handleDelete}
              title="Hapus paket buku"
              className="p-2 text-[#65676B] hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors active:scale-[0.98]"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded BOM Accordion */}
      {isExpanded && (
        <div className="border-t border-[#E4E6EB] bg-[#F7F8FA] p-4 sm:p-5">
          <h4 className="text-xs font-bold text-[#050505] uppercase tracking-wider mb-3 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-[#1877F2]" />
            Rincian Komponen Buku Satuan (Daftar Isi Paket):
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {pkg.items.map((item) => {
              const stockInfo = stock?.looseStockBreakdown?.find((s) => s.bookId === item.bookId);
              const isShortage = (stockInfo?.availableLooseStock ?? 0) < item.quantity;
              const unitSell = effectiveSellPrice(catalogBooks.find((x) => x.id === item.bookId) ?? {});

              return (
                <div
                  key={item.id}
                  className="p-3 bg-white rounded-xl border border-[#E4E6EB] shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono text-[#65676B] truncate">{item.isbn}</span>
                      <span className="text-[10px] font-semibold text-[#1877F2] bg-[#E7F3FF] px-1.5 py-0.5 rounded-sm">
                        {item.quantity} eks
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#050505] line-clamp-2">{item.title}</div>
                    <div className="text-[11px] text-[#65676B] mt-0.5">{item.author}</div>
                    <div className="text-[11px] font-bold text-[#1877F2] mt-0.5">
                      {formatRupiah(calcLooseOrderTotal([{ bookId: item.bookId, quantity: item.quantity }], catalogBooks))}
                      <span className="font-medium text-[#65676B]"> (@ {formatRupiah(unitSell)}/eks jual)</span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-[#F0F2F5] flex items-center justify-between text-[11px]">
                    <span className="text-[#65676B]">Stok Satuan:</span>
                    <span className={`font-semibold ${isShortage ? "text-amber-600" : "text-emerald-600"}`}>
                      {stockInfo?.availableLooseStock ?? 0} pcs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
