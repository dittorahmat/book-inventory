import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ExecutiveMetricValue } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";

interface ExecutiveKpiCardProps {
  title: string;
  metric: ExecutiveMetricValue;
  isCurrency?: boolean;
  subLabel?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export function ExecutiveKpiCard({
  title,
  metric,
  isCurrency = false,
  subLabel,
  icon,
  onClick,
}: ExecutiveKpiCardProps) {
  const displayVal = isCurrency ? formatRupiah(metric.current) : String(metric.current);
  const hasCompare = metric.previous !== null;
  const prevVal = hasCompare
    ? isCurrency
      ? formatRupiah(metric.previous!)
      : String(metric.previous!)
    : null;

  const isPositive = (metric.deltaPercent ?? 0) > 0;
  const isZero = metric.deltaPercent === 0 || metric.deltaPercent === null;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`bg-white rounded-2xl border border-[#E4E6EB] p-5 shadow-sm transition ${
        onClick
          ? "cursor-pointer hover:border-[#1877F2] hover:shadow-md active:scale-[0.99] text-left"
          : ""
      }`}
    >
      <div className="flex items-center justify-between text-[#65676B] text-xs font-semibold uppercase tracking-wider">
        <span>{title}</span>
        {icon && <span className="text-[#1877F2]">{icon}</span>}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-2xl font-black text-[#050505] tracking-tight">{displayVal}</div>
        {hasCompare && metric.deltaPercent !== null && (
          <div
            className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
              isZero
                ? "bg-[#F0F2F5] text-[#65676B]"
                : isPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {isZero ? (
              <Minus className="w-3 h-3 mr-0.5" />
            ) : isPositive ? (
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
            )}
            {Math.abs(metric.deltaPercent)}%
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-[#65676B] flex items-center justify-between">
        <span>{subLabel ?? (onClick ? "Klik untuk breakdown cabang →" : "")}</span>
        {hasCompare && prevVal && (
          <span className="text-[11px] text-[#8A8D91]">Lalu: {prevVal}</span>
        )}
      </div>
    </div>
  );
}
