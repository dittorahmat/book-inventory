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
      <div className="flex flex-wrap justify-center p-1 bg-[#E4E6EB]/70 rounded-2xl gap-1">
        {PUBLIC_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(tab.id)}
              className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 active:scale-[0.98] ${
                isActive ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
