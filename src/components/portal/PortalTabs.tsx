import { PUBLIC_TABS } from "./portal-tabs";
import type { PortalTab } from "./usePublicOrder";

interface PortalTabsProps {
  activeTab: PortalTab;
  onSelect: (tab: PortalTab) => void;
}

/** Tab bar portal publik, dirender dari `PUBLIC_TABS` (data-driven, teruji). */
export function PortalTabs({ activeTab, onSelect }: PortalTabsProps) {
  return (
    <div className="flex justify-center mb-6">
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center items-center p-1 bg-[#E4E6EB]/70 rounded-2xl gap-1 w-full sm:w-auto max-w-full">
        {PUBLIC_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(tab.id)}
              className={`px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] leading-tight text-center ${
                isActive ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
