export interface BreakdownItem {
  title: string;
  isbn?: string | null;
  quantity: number;
}

interface PackageBreakdownProps {
  items: BreakdownItem[];
}

/**
 * Rincian isi paket: daftar judul buku + jumlah per judul.
 * Selalu terlihat (bukan di balik expand) agar orang tua tahu
 * persis apa yang dibayar sebelum lanjut ke pembayaran.
 */
export function PackageBreakdown({ items }: PackageBreakdownProps) {
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <div className="mt-4 border-t border-[#E4E6EB] pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#65676B]">
          Rincian Isi Paket
        </p>
        <p className="text-[11px] font-semibold text-[#050505]">
          {items.length} judul &bull; {totalQty} eksemplar
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-[#65676B] bg-[#F0F2F5] rounded-xl px-3 py-2.5 text-center">
          Rincian buku belum tersedia untuk paket ini. Hubungi admin sekolah untuk daftar judul.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-xl overflow-hidden">
          {items.map((item, idx) => (
            <li key={`${item.title}-${idx}`} className="px-3 py-2 flex items-center justify-between gap-3 bg-white">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#050505] truncate">{item.title}</div>
                {item.isbn ? (
                  <div className="text-[10px] font-mono text-[#65676B] truncate">{item.isbn}</div>
                ) : null}
              </div>
              <span className="shrink-0 text-[11px] font-bold text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
                {item.quantity} eks
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
