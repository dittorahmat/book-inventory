import { DESKTOP_TABS, type ActiveTab } from "./staff-tabs";
import type { StaffRole } from "../../lib/staff-roles";

interface AppTabsNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  role: StaffRole;
}

export function AppTabsNavigation({ activeTab, onSelectTab, role }: AppTabsNavigationProps) {
  const visibleTabs = DESKTOP_TABS.filter((tab) => tab.visible(role));

  return (
    <div className="bg-white border-b border-[#E4E6EB]">
      <div className="hidden md:flex max-w-6xl mx-auto px-6 gap-1 text-sm overflow-x-auto">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelectTab(tab.id)}
              className={`py-3 px-3.5 flex items-center gap-2 font-semibold transition-all relative shrink-0 active:scale-[0.98] ${
                isActive
                  ? "text-[#1877F2] border-b-[3px] border-[#1877F2]"
                  : "text-[#65676B] hover:bg-[#F0F2F5] rounded-lg my-1 py-2 border-b-[3px] border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label(role)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface AppMobileNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  role: StaffRole;
}

export function AppMobileNavigation({ activeTab, onSelectTab, role }: AppMobileNavigationProps) {
  const visibleTabs = DESKTOP_TABS.filter((tab) => tab.visible(role));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E4E6EB] shadow-lg pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-3">
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-xl transition-colors shrink-0 min-w-[64px] active:scale-[0.98] ${
                isActive
                  ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                  : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[11px] font-semibold truncate max-w-[72px]">{tab.label(role)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
