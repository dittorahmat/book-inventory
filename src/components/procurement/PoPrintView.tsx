import { Printer, X } from "lucide-react";
import { PoWorkflowActions, type PoWorkflowTarget } from "./PoWorkflowActions";

export interface PrintablePoItem {
  title: string;
  isbn: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  discountPercent: number;
}

export interface PrintablePo {
  id: string;
  poNumber: string;
  supplierName: string;
  schoolName: string;
  orderDate: string;
  expectedArrivalDate?: string | null;
  status: string;
  notes?: string | null;
  subtotalGross?: number;
  discountTotal?: number;
  totalAmount: number;
  printedAt?: string | null;
  signedDocUrl?: string | null;
  signedDocName?: string | null;
  signedDocType?: string | null;
  signedDocUploadedAt?: string | null;
  sentAt?: string | null;
  sentTo?: string | null;
  items: PrintablePoItem[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "DRAFT",
  ordered: "DIPESAN",
  printed: "DICETAK",
  signed_uploaded: "TTD SUDAH DIUPLOAD",
  sent: "TERKIRIM KE SUPPLIER",
  partially_received: "SEBAGIAN MASUK",
  received: "SELESAI",
  cancelled: "DIBATALKAN",
};

function rupiah(n: number): string {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

function lineTotal(item: PrintablePoItem): number {
  const gross = item.quantityOrdered * item.unitPrice;
  return gross - Math.round((gross * (item.discountPercent || 0)) / 100);
}

/** Dokumen PO siap cetak untuk alur tanda tangan basah dan cap. */
export function PoPrintView({ po, onClose, onChanged }: { po: PrintablePo; onClose: () => void; onChanged: () => void }) {
  const gross = po.subtotalGross ?? po.items.reduce((s, i) => s + i.quantityOrdered * i.unitPrice, 0);
  const discount = po.discountTotal ?? 0;
  const workflow: PoWorkflowTarget = {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    printedAt: po.printedAt,
    signedDocUrl: po.signedDocUrl,
    signedDocName: po.signedDocName,
    signedDocType: po.signedDocType,
    signedDocUploadedAt: po.signedDocUploadedAt,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#F0F2F5] print:bg-white print:static">
      <div className="print:hidden sticky top-0 bg-white border-b border-[#E4E6EB] px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
          <span className="text-xs text-[#65676B] truncate">Pratinjau dokumen PO {po.poNumber}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Tutup pratinjau"
          className="p-2 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto my-6 bg-white p-8 print:my-0 print:max-w-none print:p-0 shadow-xs print:shadow-none">        <header className="flex items-start justify-between gap-6 pb-4 border-b-2 border-[#050505]">
          <div>
            <h1 className="text-lg font-bold text-[#050505] tracking-tight">PURCHASE ORDER</h1>
            <p className="text-xs text-[#65676B] mt-0.5 font-mono">{po.poNumber}</p>
          </div>
          <div className="text-right text-[11px] text-[#050505]">
            <div className="font-bold">STATUS: {STATUS_LABEL[po.status] ?? po.status}</div>
            {po.printedAt && <div>Dicetak: {po.printedAt.slice(0, 10)}</div>}
            {po.sentAt && <div>Dikirim: {po.sentAt.slice(0, 10)}</div>}
            {po.sentTo && <div>Tujuan: {po.sentTo}</div>}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-4 text-xs text-[#050505] border-b border-[#E4E6EB]">
          <div>
            <p className="font-bold uppercase text-[10px] tracking-wider text-[#65676B] mb-1">Penerima / Gudang</p>
            <p className="font-semibold">{po.schoolName}</p>
          </div>
          <div>
            <p className="font-bold uppercase text-[10px] tracking-wider text-[#65676B] mb-1">Supplier</p>
            <p className="font-semibold">{po.supplierName}</p>
          </div>
          <div>
            <p className="font-bold uppercase text-[10px] tracking-wider text-[#65676B] mb-1">Tanggal Order</p>
            <p>{po.orderDate}</p>
          </div>
          <div>
            <p className="font-bold uppercase text-[10px] tracking-wider text-[#65676B] mb-1">Estimasi Tiba</p>
            <p>{po.expectedArrivalDate || "-"}</p>
          </div>
        </section>

        <table className="w-full text-left text-xs mt-4 border-collapse">
          <thead>
            <tr className="border-y border-[#CED0D4] text-[10px] uppercase tracking-wider text-[#65676B]">
              <th className="py-2 pr-2">Judul Buku</th>
              <th className="py-2 px-2">ISBN</th>
              <th className="py-2 px-2 text-right">Qty</th>
              <th className="py-2 px-2 text-right">Harga</th>
              <th className="py-2 px-2 text-right">Diskon</th>
              <th className="py-2 pl-2 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {po.items.map((item, i) => (
              <tr key={i}>
                <td className="py-2 pr-2 font-semibold text-[#050505]">{item.title}</td>
                <td className="py-2 px-2 font-mono text-[#65676B]">{item.isbn}</td>
                <td className="py-2 px-2 text-right">{item.quantityOrdered}</td>
                <td className="py-2 px-2 text-right">{rupiah(item.unitPrice)}</td>
                <td className="py-2 px-2 text-right">{item.discountPercent || 0}%</td>
                <td className="py-2 pl-2 text-right font-bold">{rupiah(lineTotal(item))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 ml-auto w-64 text-xs divide-y divide-[#E4E6EB] border-y border-[#CED0D4]">
          <div className="flex justify-between py-1.5">
            <span className="text-[#65676B]">Total Kotor</span>
            <span className="font-semibold">{rupiah(gross)}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[#65676B]">Total Diskon</span>
            <span className="font-semibold">− {rupiah(discount)}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="font-bold">Total Netto</span>
            <span className="font-bold">{rupiah(po.totalAmount)}</span>
          </div>
        </section>

        {po.notes && (
          <section className="mt-5 text-xs text-[#050505]">
            <p className="font-bold uppercase text-[10px] tracking-wider text-[#65676B] mb-1">Catatan</p>
            <p className="whitespace-pre-wrap">{po.notes}</p>
          </section>
        )}

        <section className="mt-8 grid grid-cols-2 gap-10 text-xs text-[#050505]">
          <div>
            <p className="mb-10">Disetujui Gudang,</p>
            <div className="border-t border-[#050505] pt-1 text-[10px] text-[#65676B]">Nama & Tanda Tangan</div>
          </div>
          <div>
            <p className="mb-10">Diterima Supplier,</p>
            <div className="border-t border-[#050505] pt-1 text-[10px] text-[#65676B]">Nama & Tanda Tangan + Cap</div>
          </div>
        </section>

        {po.signedDocName && (
          <p className="mt-6 text-[10px] text-[#65676B]">Berkas bukti TTD: {po.signedDocName}</p>
        )}
      </div>

      {/* Alur pasca-cetak: tandai dicetak lalu upload bukti TTD (tidak ikut tercetak) */}
      <div className="print:hidden max-w-3xl mx-auto mb-6 bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 shadow-xs">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#65676B]">
          Langkah Berikutnya
        </p>
        <p className="mt-0.5 text-xs text-[#65676B]">
          1. Cetak dokumen di atas &amp; bubuhkan TTD + cap &nbsp;&rarr;&nbsp; 2. Tandai dicetak &nbsp;&rarr;&nbsp; 3. Upload foto/scan bukti &nbsp;&rarr;&nbsp; 4. Kirim dari daftar PO.
        </p>
        <div className="mt-3">
          <PoWorkflowActions po={workflow} onChanged={onChanged} onPrint={() => window.print()} />
        </div>
      </div>
    </div>
  );
}
