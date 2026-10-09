import { formatRupiah } from "../../lib/transfer-pricing";
import { Award, Truck, Printer, Trash2, ShieldAlert } from "lucide-react";
import type { StudentOrder } from "./order-types";

interface StudentOrdersTableProps {
  orders: StudentOrder[];
  onOpenPayment: (order: StudentOrder) => void;
  onOpenScholarship: (order: StudentOrder) => void;
  onOpenHandover: (order: StudentOrder) => void;
  onOpenDiscretion: (order: StudentOrder) => void;
  onDeleteOrder: (order: StudentOrder) => void;
}

export function StudentOrdersTable({
  orders,
  onOpenPayment,
  onOpenScholarship,
  onOpenHandover,
  onOpenDiscretion,
  onDeleteOrder,
}: StudentOrdersTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] font-semibold">
              <th className="py-3 px-4">No. Order</th>
              <th className="py-3 px-4">Nama Murid</th>
              <th className="py-3 px-4">Paket Buku</th>
              <th className="py-3 px-4">Jalur & Status Bayar</th>
              <th className="py-3 px-4">Status Buku</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#65676B]">
                  Tidak ada data pesanan siswa yang cocok.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const isPaidOrScholarship =
                  o.paymentStatus === "paid" || o.paymentStatus === "scholarship_approved";
                const isPickedUp = o.fulfillmentStatus === "picked_up";

                return (
                  <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#050505]">{o.orderNumber}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#050505]">{o.studentName}</div>
                      <div className="text-[11px] text-[#65676B]">NIS: {o.nis} &bull; Kelas {o.gradeLevel}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#050505]">{o.packageName || "-"}</div>
                      <div className="text-[11px] text-[#1877F2] font-semibold">
                        Tagihan: {formatRupiah(o.totalAmount)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {o.orderType === "scholarship" ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Award className="w-3 h-3" /> BEASISWA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
                            REGULER
                          </span>
                        )}

                        {o.paymentStatus === "paid" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                            LUNAS
                          </span>
                        )}
                        {o.paymentStatus === "partial" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                            CICILAN ({formatRupiah(o.paidAmount)})
                          </span>
                        )}
                        {o.paymentStatus === "unpaid" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-800">
                            BELUM BAYAR
                          </span>
                        )}
                        {o.paymentStatus === "scholarship_pending" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                            MENUNGGU VERIFIKASI
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        {o.orderType === "scholarship" && o.paymentStatus === "scholarship_pending" ? (
                          <button
                            type="button"
                            onClick={() => onOpenScholarship(o)}
                            className="text-[11px] text-[#1877F2] hover:underline font-semibold"
                          >
                            Cek Bukti Beasiswa &rarr;
                          </button>
                        ) : o.paymentStatus !== "paid" && o.paymentStatus !== "scholarship_approved" ? (
                          <button
                            type="button"
                            onClick={() => onOpenPayment(o)}
                            className="text-[11px] text-[#1877F2] hover:underline font-semibold"
                          >
                            Input Bayar Kasir &rarr;
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {isPickedUp ? (
                        <div>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                            SUDAH DIAMBIL
                          </span>
                          <div className="text-[10px] font-mono text-[#65676B] mt-0.5">
                            SJ: {o.handoverDeliveryNumber || "-"}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-700">
                            BELUM DIAMBIL
                          </span>
                          <div className="text-[10px] text-[#65676B] mt-0.5">
                            {isPaidOrScholarship ? "Siap diserahkan" : "Menunggu pelunasan / diskresi"}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isPickedUp ? (
                          <button
                            onClick={() => onOpenHandover(o)}
                            className="px-3 py-1.5 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs inline-flex items-center gap-1.5 active:scale-[0.98]"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Serahkan Buku</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => window.print()}
                            className="px-3 py-1.5 bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] font-semibold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5"
                            title="Cetak Surat Jalan Serah Terima"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#65676B]" />
                            <span>Surat Jalan</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDiscretion(o)}
                          title="Diskresi Finance (Diskon / Gratis / Izin Ambil)"
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors active:scale-[0.98]"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteOrder(o)}
                          title="Hapus pesanan siswa"
                          className="p-1.5 text-[#65676B] hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors active:scale-[0.98]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
