import { Loader2 } from "lucide-react";

export function DashboardLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-xs text-[#65676B]">
      <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#1877F2]" /> Memuat dashboard...
    </div>
  );
}
