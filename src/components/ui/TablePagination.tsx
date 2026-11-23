export interface TablePaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  itemName?: string;
  showWhenSinglePage?: boolean;
}

export function TablePagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  itemName = "data",
  showWhenSinglePage = false,
}: TablePaginationProps) {
  if (total <= 0 || (totalPages <= 1 && total <= limit && !showWhenSinglePage)) {
    return null;
  }

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-[#F0F2F5] border-t border-[#CED0D4] text-xs text-[#65676B]">
      <div>
        Menampilkan baris <span className="font-semibold text-[#050505]">{start} - {end}</span> dari total{" "}
        <span className="font-bold text-[#050505]">{total}</span> {itemName}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-[#CED0D4] bg-white text-[#050505] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F2F3F5] transition"
        >
          Sebelumnya
        </button>
        <span className="font-semibold text-[#050505] px-1">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-[#CED0D4] bg-white text-[#050505] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F2F3F5] transition"
        >
          Selanjutnya
        </button>
      </div>
    </div>
  );
}
