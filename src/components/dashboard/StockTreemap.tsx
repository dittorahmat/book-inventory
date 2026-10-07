import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";

// Palette colors for Treemap tiles (B2B educational palette)
const TILE_COLORS = [
  "#1877F2", // Core blue
  "#2563EB",
  "#3B82F6",
  "#0284C7",
  "#0D9488",
  "#10B981",
  "#059669",
  "#6366F1",
  "#8B5CF6",
  "#475569",
];

interface CustomContentProps {
  root?: unknown;
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  value?: number;
}

function TreemapTile(props: CustomContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, name = "", value = 0 } = props;

  if (width < 30 || height < 24) return null;

  const bg = TILE_COLORS[index % TILE_COLORS.length];
  const showDetail = width > 75 && height > 45;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        style={{
          fill: bg,
          stroke: "#FFFFFF",
          strokeWidth: 2,
        }}
      />
      {width > 40 && height > 24 && (
        <text
          x={x + 8}
          y={y + (showDetail ? 18 : height / 2 + 4)}
          fill="#FFFFFF"
          fontSize={width > 120 ? 12 : 10}
          fontWeight={700}
          style={{ pointerEvents: "none" }}
        >
          {name.length > Math.floor(width / 7)
            ? `${name.slice(0, Math.max(3, Math.floor(width / 7) - 3))}…`
            : name}
        </text>
      )}
      {showDetail && (
        <text
          x={x + 8}
          y={y + 34}
          fill="#FFFFFF"
          fillOpacity={0.85}
          fontSize={10}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {value} eks
        </text>
      )}
    </g>
  );
}

function TreemapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { name?: string; value?: number; available?: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-lg px-3 py-2 text-xs">
      <div className="font-bold text-[#050505] max-w-[200px] break-words">{data.name}</div>
      <div className="mt-1 flex items-center justify-between gap-4 text-[#65676B]">
        <span>Total Stok:</span>
        <span className="font-bold text-[#050505]">{data.value} eksemplar</span>
      </div>
      {typeof data.available === "number" && (
        <div className="flex items-center justify-between gap-4 text-[#65676B]">
          <span>Tersedia:</span>
          <span className="font-semibold text-emerald-600">{data.available} eksemplar</span>
        </div>
      )}
    </div>
  );
}

export function StockTreemap({ summary }: { summary: DashboardSchoolSummary }) {
  const titles = summary.stock.byTitle ?? [];

  // Filter books with positive quantity, sort descending, top 12
  const topBooks = [...titles]
    .filter((b) => b.totalQty > 0)
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 12);

  const data = topBooks.map((b) => ({
    name: b.title,
    value: b.totalQty,
    available: b.availableQty,
  }));

  const totalQty = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-bold text-[#050505]">Peta Sebaran Stok Judul Buku</div>
          <div className="text-xs text-[#65676B]">
            Proporsi volume stok judul buku terbesar di cabang (Top 12)
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#65676B]">
          {totalQty} eks
        </span>
      </div>

      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#65676B]">
          Belum ada data stok judul buku pada sekolah ini.
        </div>
      ) : (
        <div className="w-full h-[220px] mt-2">
          <ResponsiveContainer width="100%" height={220}>
            <Treemap
              data={data}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="#fff"
              content={<TreemapTile />}
            >
              <Tooltip content={<TreemapTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
