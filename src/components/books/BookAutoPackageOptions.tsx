import { Package } from "lucide-react";

interface BookAutoPackageOptionsProps {
  autoCreatePackages: boolean;
  onAutoCreateChange: (val: boolean) => void;
  academicYear: string;
  onAcademicYearChange: (val: string) => void;
}

export function BookAutoPackageOptions({
  autoCreatePackages,
  onAutoCreateChange,
  academicYear,
  onAcademicYearChange,
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
        <div className="flex items-center gap-2 text-xs pt-1">
          <span className="text-[#65676B]">Tahun Ajaran Paket:</span>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => onAcademicYearChange(e.target.value)}
            className="px-2 py-1 text-xs border border-[#CED0D4] rounded-lg w-28 bg-white font-medium"
          />
        </div>
      )}
    </div>
  );
}
