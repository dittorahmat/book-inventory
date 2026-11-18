import { Package, AlertTriangle } from "lucide-react";

interface BookAutoPackageOptionsProps {
  autoCreatePackages: boolean;
  onAutoCreateChange: (val: boolean) => void;
  academicYear: string;
  onAcademicYearChange: (val: string) => void;
  forcePackageOverride?: boolean;
  onForcePackageOverrideChange?: (val: boolean) => void;
  hasPartialWarning?: boolean;
}

export function BookAutoPackageOptions({
  autoCreatePackages,
  onAutoCreateChange,
  academicYear,
  onAcademicYearChange,
  forcePackageOverride = false,
  onForcePackageOverrideChange,
  hasPartialWarning = false,
}: BookAutoPackageOptionsProps) {
  return (
    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#050505]">
        <input
          type="checkbox"
          checked={autoCreatePackages}
          onChange={(e) => onAutoCreateChange(e.target.checked)}
          className="w-4 h-4 text-[#1877F2] rounded focus:ring-0 cursor-pointer"
        />
        <span className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[#1877F2]" />
          Otomatis buat Paket Bundling Buku (BOM) per Tingkat Kelas
        </span>
      </label>
      {autoCreatePackages && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#65676B]">Tahun Ajaran Paket:</span>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => onAcademicYearChange(e.target.value)}
              className="px-2 py-1 text-xs border border-[#CED0D4] rounded-lg w-28 bg-white font-medium"
            />
          </div>

          {hasPartialWarning && onForcePackageOverrideChange && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1.5 animate-in fade-in">
              <div className="flex items-start gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Peringatan: Berkas terdeteksi hanya berisi &lt; 10 buku per jenjang (parsial).</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Untuk mencegah rusaknya paket lengkap yang sudah ada (misal tertimpa hanya buku agama),
                sistem akan melindungi paket eksisting kecuali Anda secara sengaja mengizinkannya.
              </p>
              <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={forcePackageOverride}
                  onChange={(e) => onForcePackageOverrideChange(e.target.checked)}
                  className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-0 cursor-pointer"
                />
                <span>Tetap perbarui/timpa paket bundling dengan buku parsial ini</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
