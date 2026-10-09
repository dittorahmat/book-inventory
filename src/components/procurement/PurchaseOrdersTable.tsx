import { FileText, Calendar, Truck, PackageCheck, CheckCircle2 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { PoWorkflowActions } from "./PoWorkflowActions";
import { toPrintablePo, type PurchaseOrder } from "./procurement-types";
import type { PrintablePo } from "./PoPrintView";

interface PurchaseOrdersTableProps {
  purchaseOrders: PurchaseOrder[];
  isLoading: boolean;
  onSelectDetail: (po: PurchaseOrder) => void;
  onPrint: (printable: PrintablePo) => void;
  onReceive: (po: PurchaseOrder) => void;
  onChanged: () => void;
}

export function PurchaseOrdersTable({
  purchaseOrders,
  isLoading,
  onSelectDetail,
  onPrint,
  onReceive,
  onChanged,
}: PurchaseOrdersTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">No. PO & Tanggal</th>
              <th className="py-3 px-4">Supplier & Tujuan</th>
              <th className="py-3 px-4">Item Buku Dipesan</th>
              <th className="py-3 px-4">Status & Progress</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#65676B]">
                  Memuat data Purchase Order...
                </td>
              </tr>
            ) : purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <div className="max-w-xs mx-auto text-[#65676B] space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-[#CED0D4]" />
                    <div className="font-semibold text-xs text-[#050505]">Belum ada Purchase Order</div>
                    <p className="text-[11px]">
                      Klik tombol <strong>+ Buat PO Baru</strong> di atas untuk memesan buku lepasan ke supplier resmi.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => {
                const isFullyReceived = po.status === "received";
                const totalOrdered = po.items.reduce((s, it) => s + it.quantityOrdered, 0);
                const totalReceived = po.items.reduce((s, it) => s + it.quantityReceived, 0);
                const percent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

                return (
                  <tr key={po.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-xs text-[#1877F2]">
                        <button
                          type="button"
                          onClick={() => onSelectDetail(po)}
                          className="hover:underline inline-flex items-center gap-1 active:scale-[0.98]"
                          title="Buka detail PO"
                        >
                          {po.poNumber}
                          <FileText className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-[#65676B] mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#65676B]" />
                        <span>{po.orderDate}</span>
                      </div>
                      {po.expectedArrivalDate && (
                        <div className="text-[10px] text-amber-700 mt-0.5">
                          Est. Tiba: {po.expectedArrivalDate}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#050505]">{po.supplierName}</div>
                      <div className="text-[11px] text-[#65676B] flex items-center gap-1 mt-0.5">
                        <Truck className="w-3 h-3 text-[#65676B]" />
                        <span>Tujuan: {po.schoolName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {po.items.map((it) => (
                          <div key={it.id} className="text-[11px]">
                            <span className="font-semibold text-[#050505]">{it.title}</span>:{" "}
                            <span className="text-[#1877F2] font-semibold">{it.quantityReceived}</span>
                            <span className="text-[#65676B]">/{it.quantityOrdered} eks</span>
                            {it.discountPercent > 0 && (
                              <span className="ml-1 px-1.5 py-px text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                −{it.discountPercent}%
                              </span>
                            )}
                          </div>
                        ))}
                        <div className="text-[11px] pt-0.5 border-t border-[#E4E6EB]">
                          <span className="text-[#65676B]">Netto: </span>
                          <span className="font-bold text-[#050505]">
                            {formatRupiah(
                              po.subtotalGross !== undefined && po.discountTotal !== undefined
                                ? po.subtotalGross - po.discountTotal
                                : po.totalAmount
                            )}
                          </span>
                          {po.discountTotal !== undefined && po.discountTotal > 0 && (
                            <span className="text-[#65676B]">
                              {" "}(kotor {formatRupiah(po.subtotalGross)})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1.5">
                        {po.status === "draft" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#F0F2F5] text-[#65676B] border border-[#CED0D4] inline-block">
                            DRAFT (BELUM DICETAK)
                          </span>
                        )}
                        {po.status === "printed" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-block">
                            DICETAK — MENUNGGU BUKTI TTD
                          </span>
                        )}
                        {po.status === "signed_uploaded" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#E7F3FF] text-[#1877F2] border border-[#B2D8FF] inline-block">
                            TTD SUDAH DIUPLOAD
                          </span>
                        )}
                        {po.status === "ordered" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                            ORDERED (DIPESAN)
                          </span>
                        )}
                        {po.status === "sent" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                            TERKIRIM KE SUPPLIER
                          </span>
                        )}
                        {po.status === "partially_received" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-block">
                            SEBAGIAN MASUK
                          </span>
                        )}
                        {po.status === "received" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                            SELESAI (LENGKAP)
                          </span>
                        )}

                        <div className="w-32 bg-[#F0F2F5] rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${isFullyReceived ? "bg-emerald-500" : "bg-[#1877F2]"}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-[#65676B]">
                          {totalReceived} dari {totalOrdered} eks ({percent}%)
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <PoWorkflowActions
                          po={po}
                          onChanged={onChanged}
                          onPrint={() => onPrint(toPrintablePo(po))}
                        />
                        {!isFullyReceived ? (
                          <button
                            type="button"
                            onClick={() => onReceive(po)}
                            className="px-3 py-1.5 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs inline-flex items-center gap-1.5 active:scale-[0.98]"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Terima Inbound</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Masuk Stok
                          </span>
                        )}
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
