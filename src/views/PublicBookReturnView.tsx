import { RotateCcw, ArrowLeft, ClipboardList } from "lucide-react";
import { useBookReturn } from "../components/portal/useBookReturn";
import { BookReturnSearchStep } from "../components/portal/BookReturnSearchStep";
import type { SchoolOption } from "../lib/portal-types";

interface PublicBookReturnViewProps {
  schools: SchoolOption[];
}

export function PublicBookReturnView({ schools }: PublicBookReturnViewProps) {
  const ret = useBookReturn();

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-3">
          <RotateCcw className="w-4 h-4" />
          <span>Pengembalian &amp; Refund Buku</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#050505]">Pengajuan Refund Buku</h1>
        <p className="text-xs text-[#65676B] mt-1 max-w-md mx-auto">
          Cari pesanan buku anak Anda, pilih judul yang dikembalikan, lalu lampirkan foto kondisi fisik buku.
        </p>
      </div>

      {!ret.selectedOrder ? (
        <BookReturnSearchStep
          schools={schools}
          schoolId={ret.schoolId}
          setSchoolId={ret.setSchoolId}
          query={ret.query}
          setQuery={ret.setQuery}
          searching={ret.searching}
          searched={ret.searched}
          orders={ret.orders}
          error={ret.error}
          onSearch={ret.handleSearch}
          onSelectOrder={ret.selectOrder}
        />
      ) : (
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E4E6EB]">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wider">Pesanan Dipilih</span>
              <div className="text-sm font-bold text-[#050505] mt-1 truncate">{ret.selectedOrder.studentName}</div>
              <div className="text-xs text-[#65676B] mt-0.5">
                NIS {ret.selectedOrder.nis} &bull; {ret.selectedOrder.orderNumber}
                {ret.selectedOrder.handoverDeliveryNumber ? ` &bull; SJ ${ret.selectedOrder.handoverDeliveryNumber}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={() => ret.setSelectedOrder(null)}
              className="text-xs font-semibold text-[#1877F2] hover:underline shrink-0 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Ganti Pesanan
            </button>
          </div>

          <div className="p-4 bg-[#F0F2F5] border border-[#E4E6EB] rounded-xl flex items-start gap-3">
            <ClipboardList className="w-4 h-4 text-[#65676B] shrink-0 mt-0.5" />
            <p className="text-xs text-[#65676B]">
              Pesanan ini siap diajukan refund. Lanjutkan dengan memilih judul buku dan melampirkan bukti foto.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
