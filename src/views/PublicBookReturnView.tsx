import { RotateCcw, CheckCircle2 } from "lucide-react";
import { useBookReturn } from "../components/portal/useBookReturn";
import { BookReturnSearchStep } from "../components/portal/BookReturnSearchStep";
import { BookReturnFormStep } from "../components/portal/BookReturnFormStep";
import type { SchoolOption } from "../lib/portal-types";

interface PublicBookReturnViewProps {
  schools: SchoolOption[];
}

export function PublicBookReturnView({ schools }: PublicBookReturnViewProps) {
  const ret = useBookReturn();

  if (ret.success) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#050505]">Pengajuan Refund Terkirim</h2>
        <p className="text-xs text-[#65676B] max-w-md mx-auto leading-relaxed">
          Nomor referensi pengajuan Anda{" "}
          <span className="font-mono font-bold text-[#050505]">{ret.success.returnId}</span> untuk pesanan{" "}
          <span className="font-semibold text-[#050505]">{ret.success.orderNumber}</span>. Tim logistik gudang akan
          memeriksa kondisi fisik buku sebelum menyetujui pengembalian dana.
        </p>
        <button
          type="button"
          onClick={ret.reset}
          className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all"
        >
          Ajukan Pengembalian Lain
        </button>
      </div>
    );
  }

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
        <BookReturnFormStep
          order={ret.selectedOrder}
          bookChoices={ret.bookChoices}
          booksLoading={ret.booksLoading}
          booksError={ret.booksError}
          selectedBookId={ret.selectedBookId}
          setSelectedBookId={ret.setSelectedBookId}
          reason={ret.reason}
          setReason={ret.setReason}
          photoBase64={ret.photoBase64}
          onPhoto={ret.handlePhoto}
          submitting={ret.submitting}
          error={ret.error}
          onSubmit={ret.submit}
          onBack={() => ret.setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
