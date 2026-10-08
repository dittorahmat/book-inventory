import type { ReactNode } from "react";

/**
 * Kit kartu dasbor: satu-satunya pemilik cangkang kartu, status kosong
 * yang edukatif, dan tooltip grafik. Nada cakupan tinggal di modul
 * coverage-tone; grafik adalah adapter bodoh di atas kit.
 */

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Cangkang kartu tunggal semua grafik dasbor. */
export function ChartCard({ title, subtitle, action, children, className }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E4E6EB] p-5 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-[#050505]">{title}</div>
          {subtitle ? <div className="text-xs text-[#65676B] mt-0.5">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Status kosong edukatif: menjelaskan arti nol + langkah lanjut. */
export function ChartEmpty({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="py-8 text-center">
      <div className="text-sm text-[#65676B]">{message}</div>
      {hint ? <div className="mt-1 text-xs text-[#90949C]">{hint}</div> : null}
    </div>
  );
}

interface ChartTooltipRow {
  label: string;
  value: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  title?: string;
  rows?: ChartTooltipRow[];
}

/** Tooltip generik konten recharts: judul + baris label/nilai. */
export function ChartTooltip({ active, title, rows }: ChartTooltipProps) {
  if (!active || !rows || rows.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-md px-3 py-2 text-xs">
      {title ? <div className="font-bold text-[#050505]">{title}</div> : null}
      {rows.map((r) => (
        <div key={r.label} className="text-[#65676B]">
          {r.label}: <span className="font-semibold text-[#050505]">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
