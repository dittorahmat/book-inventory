import { Download, X } from "lucide-react";

interface ExecutiveBreakdownDrawerShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  category: string;
  academicYear: string;
  maxWidthClass?: string;
  onExportCsv?: () => void;
  metricsSummary?: React.ReactNode;
  children: React.ReactNode;
}

export function ExecutiveBreakdownDrawerShell({
  isOpen,
  onClose,
  title,
  category,
  academicYear,
  maxWidthClass = "max-w-4xl",
  onExportCsv,
  metricsSummary,
  children,
}: ExecutiveBreakdownDrawerShellProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 flex justify-end transition-opacity">
      <div className={`w-full ${maxWidthClass} bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200`}>
        {/* Header Drawer */}
        <div className="p-5 border-b border-[#E4E6EB] flex items-center justify-between bg-[#F7F8FA]">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#1877F2]">{category}</div>
            <h2 className="text-lg font-black text-[#050505] mt-0.5">{title}</h2>
            <div className="text-xs text-[#65676B]">Tahun Ajaran: {academicYear}</div>
          </div>
          <div className="flex items-center gap-2">
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1877F2] bg-white border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Unduh CSV
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup drawer"
              className="p-1.5 rounded-lg text-[#65676B] hover:bg-[#E4E6EB] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Ringkasan Makro */}
        {metricsSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-[#F0F2F5]/50 border-b border-[#E4E6EB]">
            {metricsSummary}
          </div>
        )}

        {/* Isi Drawer / Tabel */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
