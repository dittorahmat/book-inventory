import type { LucideIcon } from "lucide-react";

export interface SegmentedSubNavItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface SegmentedSubNavProps<T extends string> {
  items: readonly SegmentedSubNavItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}

/**
 * Komponen sub-navigasi segmented kanonik untuk view dengan banyak tab internal
 * (seperti Seragam, Gudang Buku). Menyediakan tombol pil seragam dengan active shadow.
 */
export function SegmentedSubNav<T extends string>({
  items,
  activeId,
  onChange,
  className = "",
}: SegmentedSubNavProps<T>) {
  return (
    <nav className={`flex flex-wrap items-center p-1 bg-[#F0F2F5] rounded-xl gap-1 border border-[#E4E6EB]/60 ${className}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.98] ${
              active
                ? "bg-white text-[#1877F2] shadow-xs"
                : "text-[#65676B] hover:text-[#050505] hover:bg-white/60"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${active ? "text-[#1877F2]" : "text-[#65676B]"}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
