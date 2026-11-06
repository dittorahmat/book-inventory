import { useCallback, useEffect, useState } from "react";
import { Search, SlidersHorizontal, RefreshCw } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { PaymentReviewModal } from "../orders/PaymentReviewModal";
import { formatNotification } from "../../lib/payment-review-types";
import {
  fetchUniformOrders,
  markUniformShipped,
  saveUniformShipping,
  sendUniformInvoice,
  resolveUniformScholarship,
  downloadUniformCsv,
  importUniformShipping,
  fetchUniformOrderPayments,
  verifyUniformPayment,
  rejectUniformPayment,
  payUniformOrder,
  type UniformOrderRow,
} from "./uniform-admin-api";
import { UniformShippingBatchModal } from "./UniformShippingBatchModal";
import { UniformOrderCard } from "./UniformOrderCard";
import { UniformOngkirModal, UniformCashierPayModal } from "./UniformShipmentActionModals";

interface Props {
  schools: Array<{ id: string; name: string }>;
  lockedSchoolId?: string | null;
}

export function UniformShipmentSection({ schools, lockedSchoolId }: Props) {
  const [schoolId, setSchoolId] = useState(lockedSchoolId ?? "");
  const [status, setStatus] = useState("belum_dikirim");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<UniformOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & sub-form states
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [paidOnly, setPaidOnly] = useState(true);
  const [importText, setImportText] = useState("");
  const [importShipped, setImportShipped] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Modal Contextual Actions
  const [ongkirOrder, setOngkirOrder] = useState<UniformOrderRow | null>(null);
  const [payOrder, setPayOrder] = useState<UniformOrderRow | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payResult, setPayResult] = useState<string | null>(null);

  const [reviewRow, setReviewRow] = useState<UniformOrderRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        await fetchUniformOrders({
          schoolId: schoolId || undefined,
          shipmentStatus: status || undefined,
          search: search.trim() || undefined,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat order seragam.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleShip = async (id: string) => {
    setShippingId(id);
    setError(null);
    try {
      await markUniformShipped(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai kiriman.");
    } finally {
      setShippingId(null);
    }
  };

  const handleSaveOngkir = async (cost: string, resi: string) => {
    if (!ongkirOrder) return;
    setError(null);
    try {
      await saveUniformShipping(ongkirOrder.id, parseInt(cost) || 0, resi.trim() || undefined);
      setOngkirOrder(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan ongkir.");
    }
  };

  const handleInvoice = async (id: string, studentName: string) => {
    if (!window.confirm(`Kirim invoice + link pembayaran ke ortu ${studentName} via WhatsApp?`)) return;
    setError(null);
    try {
      await sendUniformInvoice(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim invoice.");
    }
  };

  const handleScholarship = async (id: string, action: "approve" | "reject") => {
    if (!window.confirm(`Beasiswa seragam di-${action === "approve" ? "setujui" : "tolak"}?`)) return;
    setError(null);
    try {
      await resolveUniformScholarship(id, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui beasiswa.");
    }
  };

  const handleExport = async (type: "packing" | "ekspedisi") => {
    try {
      await downloadUniformCsv({ schoolId: schoolId || "", format: type, paidOnly });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh data.");
    }
  };

  const handleImport = async () => {
    const lines = importText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rawRows = lines[0]?.toLowerCase().startsWith("nis") ? lines.slice(1) : lines;
    const parsed = rawRows
      .map((line) => {
        const [nis = "", resi = "", ongkir = ""] = line.split(/[;\t,]/).map((c) => c.trim());
        return { nis, resi: resi || undefined, ongkir: ongkir ? Number(ongkir) || 0 : 0 };
      })
      .filter((r) => r.nis);

    if (parsed.length === 0 || !schoolId) {
      setError("Isi data CSV (nis;resi;ongkir) dan pilih sekolah.");
      return;
    }
    setImportBusy(true);
    setError(null);
    setImportResult(null);
    try {
      const res = await importUniformShipping({ schoolId, markShipped: importShipped, rows: parsed });
      setImportResult(
        `${res.updated.length} diperbarui, ${res.rejected.length} ditolak${
          res.rejected.length > 0 ? `: ${res.rejected.map((r) => `${r.nis} (${r.reason})`).join("; ")}` : ""
        }.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor data.");
    } finally {
      setImportBusy(false);
    }
  };

  const handlePay = async (transfer: string, allocation: string, bank: string) => {
    if (!payOrder) return;
    setPayBusy(true);
    setError(null);
    try {
      const t = parseInt(transfer) || 0;
      const a = parseInt(allocation) || 0;
      const res = await payUniformOrder(payOrder.id, { transferAmount: t, allocationAmount: a, bankName: bank });
      setPayResult(`Pembayaran berhasil dicatat.${res.notification ? " " + formatNotification("verifikasi", res.notification) : ""}`);
      setPayOrder(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat pembayaran.");
    } finally {
      setPayBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Integrated Single Toolbar */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#050505]">Daftar Pengiriman Seragam</h2>
            <p className="text-xs text-[#65676B]">
              Pantau status fulfillment, nomor resi ekspedisi, dan invoice seragam siswa.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#CED0D4] bg-white text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98] transition-all shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#1877F2]" />
              <span>Ekspor & Impor CSV</span>
            </button>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="p-2 border border-[#CED0D4] bg-white text-[#65676B] hover:text-[#050505] rounded-xl text-xs hover:bg-[#F0F2F5] active:scale-[0.98] transition-all shadow-2xs"
              title="Segarkan data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-[#E4E6EB]">
          <div>
            <SearchableSingleSelect
              label="Sekolah"
              options={[
                ...(!lockedSchoolId ? [{ value: "", label: "🏢 Semua Cabang" }] : []),
                ...schools.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={schoolId}
              onChange={setSchoolId}
              placeholder="Pilih sekolah / cabang..."
              disabled={!!lockedSchoolId}
            />
          </div>

          <div>
            <SearchableSingleSelect
              label="Status Pengiriman"
              options={[
                { value: "belum_dikirim", label: "Belum terkirim" },
                { value: "sudah_dikirim", label: "Sudah terkirim" },
                { value: "superseded", label: "Tertimpa (Superseded)" },
                { value: "", label: "Semua Status" },
              ]}
              value={status}
              onChange={setStatus}
              placeholder="Pilih status..."
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#050505] mb-1">Cari Order</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Cari nama siswa, NIS, atau no. order..."
                className="pl-9 pr-3 py-2 text-xs font-medium border border-[#CED0D4] rounded-xl bg-white hover:border-[#1877F2] w-full focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {payResult && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {payResult}
        </div>
      )}

      {/* Orders List Container */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB] shadow-xs">
        {loading && <div className="px-4 py-12 text-center text-xs text-[#65676B]">Memuat daftar pesanan…</div>}
        {!loading && rows.length === 0 && (
          <div className="px-4 py-12 text-center text-xs text-[#65676B]">
            Tidak ada order pada filter ini. Order baru muncul setelah ortu memesan via portal seragam.
          </div>
        )}
        {!loading &&
          rows.map((r) => (
            <UniformOrderCard
              key={r.id}
              order={r}
              shippingId={shippingId}
              onShip={handleShip}
              onOpenOngkir={(ord) => setOngkirOrder(ord)}
              onInvoice={handleInvoice}
              onScholarship={handleScholarship}
              onReview={(ord) => setReviewRow(ord)}
              onOpenPay={(ord) => {
                setPayOrder(ord);
                setPayResult(null);
              }}
            />
          ))}
      </div>

      {/* Modal Input Ongkir & Resi */}
      {ongkirOrder && (
        <UniformOngkirModal
          isOpen={true}
          orderNumber={ongkirOrder.orderNumber}
          studentName={ongkirOrder.studentName}
          initialCost={String(ongkirOrder.shippingCost ?? "")}
          initialResi={ongkirOrder.shippingResi ?? ""}
          onSave={handleSaveOngkir}
          onCancel={() => setOngkirOrder(null)}
        />
      )}

      {/* Modal Input Bayar Manual Kasir */}
      {payOrder && (
        <UniformCashierPayModal
          isOpen={true}
          orderNumber={payOrder.orderNumber}
          studentName={payOrder.studentName}
          busy={payBusy}
          onSave={handlePay}
          onCancel={() => setPayOrder(null)}
        />
      )}

      {/* Modal Review Bukti Pembayaran */}
      {reviewRow && (
        <PaymentReviewModal
          heading={`Order ${reviewRow.orderNumber}`}
          subheading={`${reviewRow.studentName} · ${reviewRow.schoolName}`}
          load={() => fetchUniformOrderPayments(reviewRow.id)}
          verify={(paymentId) => verifyUniformPayment(reviewRow.id, paymentId)}
          reject={(paymentId, reason) => rejectUniformPayment(reviewRow.id, paymentId, reason)}
          onClose={() => setReviewRow(null)}
          onChanged={load}
        />
      )}

      {/* Modal Ekspor & Impor Batch */}
      <UniformShippingBatchModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onExport={handleExport}
        paidOnly={paidOnly}
        onPaidOnlyChange={setPaidOnly}
        importText={importText}
        onImportTextChange={setImportText}
        importShipped={importShipped}
        onImportShippedChange={setImportShipped}
        importBusy={importBusy}
        importResult={importResult}
        onImport={handleImport}
        hasSchoolSelected={!!schoolId}
      />
    </div>
  );
}
