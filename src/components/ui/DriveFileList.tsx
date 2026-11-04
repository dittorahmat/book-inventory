import { FileSpreadsheet, Folder } from "lucide-react";

export interface DriveFolderItem {
  id: string;
  name: string;
  type: "spreadsheet" | "folder";
}

interface DriveFileListProps {
  files: DriveFolderItem[];
  onSelect: (file: DriveFolderItem) => void;
  title?: string;
}

export function DriveFileList({ files, onSelect, title }: DriveFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-[#050505]">
        <span className="flex items-center gap-1.5">
          <Folder className="w-4 h-4 text-amber-500" />
          {title || "Berkas Spreadsheet Terdeteksi di Folder"} ({files.length})
        </span>
        <span className="text-[11px] text-[#65676B]">Pilih berkas untuk dipratinjau & diimpor:</span>
      </div>
      <div className="border border-[#E4E6EB] rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-[#E4E6EB] text-xs">
        {files.map((f) => (
          <div
            key={f.id}
            onClick={() => onSelect(f)}
            className="p-2.5 flex items-center justify-between hover:bg-blue-50 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2 truncate pr-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate font-medium text-[#050505]">{f.name}</span>
            </div>
            <button
              type="button"
              className="px-2.5 py-1 text-[11px] font-semibold text-[#1877F2] bg-blue-50 hover:bg-blue-100 rounded-lg shrink-0"
            >
              Pilih & Baca
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
