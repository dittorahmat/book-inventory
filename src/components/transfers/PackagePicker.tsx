import { formatRupiah } from "../../lib/transfer-pricing";

export interface ReadyBundle {
  id: string;
  barcode: string;
  packageId: string;
  packageCode: string;
  packageName: string;
  packagePrice: number;
}

interface PackagePickerProps {
  bundles: ReadyBundle[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function PackagePicker({ bundles, selectedIds, onToggle }: PackagePickerProps) {
  if (bundles.length === 0) {
    return (
      <div className="text-[#65676B] py-3 text-center">
        Belum ada bundel ready di cabang ini. Rakit dulu di tab Paket Buku.
      </div>
    );
  }

  const groups = new Map<string, ReadyBundle[]>();
  for (const b of bundles) {
    const list = groups.get(b.packageId) || [];
    list.push(b);
    groups.set(b.packageId, list);
  }

  return (
    <div className="space-y-2.5">
      {[...groups.entries()].map(([packageId, items]) => (
        <div key={packageId}>
          <div className="px-2 pt-1 pb-1 text-[11px] font-bold text-[#65676B] flex items-center justify-between">
            <span>
              {items[0].packageCode} - {items[0].packageName}
            </span>
            <span className="text-[#1877F2]">{formatRupiah(items[0].packagePrice)}</span>
          </div>
          {items.map((b) => (
            <label
              key={b.id}
              className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(b.id)}
                  onChange={() => onToggle(b.id)}
                  className="rounded border-[#CED0D4] text-[#1877F2] focus:ring-[#1877F2] w-4 h-4 shrink-0"
                />
                <span className="font-mono text-xs font-bold text-[#1877F2] shrink-0">{b.barcode}</span>
              </div>
              <span className="text-[11px] font-bold text-[#1877F2] shrink-0">
                {formatRupiah(b.packagePrice)}
              </span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
