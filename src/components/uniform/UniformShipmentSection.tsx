import { useCallback, useEffect, useState } from "react";
import { PaymentReviewModal } from "../orders/PaymentReviewModal";
import { formatNotification } from "../../lib/payment-review-types";
import {
  fetchUniformOrders,
  markUniformShipped,
  saveUniformShipping,
  sendUniformInvoice,
  sendUniformShippingNotification,
  confirmUniformReceipt,
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
import { UniformShipModal, UniformConfirmReceiptModal } from "./UniformShipModal";
import { UniformShipmentToolbar } from "./UniformShipmentToolbar";
import { canDispatchUniformOrder } from "../../lib/order-handover-guard";

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
  const [shipModalOrder, setShipModalOrder] = useState<UniformOrderRow | null>(null);
  const [receiptModalOrder, setReceiptModalOrder] = useState<UniformOrderRow | null>(null);
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

  const handleOpenShipModal = (order: UniformOrderRow) => {
    // Validasi payment status di frontend sebelum buka modal via single-writer kanonik (§0.75)
    if (!canDispatchUniformOrder(order)) {
      setError(`Order ${order.orderNumber} belum layak kirim karena pembayaran masih unpaid.`);
      return;
    }
    setError(null);
    setShipModalOrder(order);
  };

  const handleConfirmShip = async (payload: { shippingResi: string; packagePhotoBase64?: string }) => {
    if (!shipModalOrder) return;
    setShippingId(shipModalOrder.id);
    setError(null);
    try {
      await markUniformShipped(shipModalOrder.id, payload);
      setShipModalOrder(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai kiriman.");
      throw err;
    } finally {
      setShippingId(null);
    }
  };

  const handleSendResiNotification = async (id: string) => {
    setError(null);
    try {
      await sendUniformShippingNotification(id);
      alert("Notifikasi resi berhasil dikirim ke nomor WhatsApp orang tua.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim notifikasi resi.");
    }
  };

  const handleConfirmReceipt = async (notes?: string) => {
    if (!receiptModalOrder) return;
    setError(null);
    try {
      await confirmUniformReceipt(receiptModalOrder.id, notes);
      setReceiptModalOrder(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat konfirmasi penerimaan.");
      throw err;
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
      <UniformShipmentToolbar
        schools={schools}
        lockedSchoolId={lockedSchoolId}
        schoolId={schoolId}
        setSchoolId={setSchoolId}
        status={status}
        setStatus={setStatus}
        search={search}
        setSearch={setSearch}
        loading={loading}
        onRefresh={load}
        onOpenBatch={() => setShowBatchModal(true)}
      />

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
              onShip={handleOpenShipModal}
              onOpenOngkir={(ord) => setOngkirOrder(ord)}
              onInvoice={handleInvoice}
              onSendResiNotification={handleSendResiNotification}
              onConfirmReceipt={(ord) => setReceiptModalOrder(ord)}
              onScholarship={handleScholarship}
              onReview={(ord) => setReviewRow(ord)}
              onOpenPay={(ord) => {
                setPayOrder(ord);
                setPayResult(null);
              }}
            />
          ))}
      </div>

      {/* Modal Pengiriman Seragam Ber-Resi */}
      {shipModalOrder && (
        <UniformShipModal
          isOpen={true}
          order={shipModalOrder}
          isSubmitting={shippingId === shipModalOrder.id}
          onConfirm={handleConfirmShip}
          onCancel={() => setShipModalOrder(null)}
        />
      )}

      {/* Modal Konfirmasi Penerimaan Paket */}
      {receiptModalOrder && (
        <UniformConfirmReceiptModal
          isOpen={true}
          orderNumber={receiptModalOrder.orderNumber}
          studentName={receiptModalOrder.studentName}
          onConfirm={handleConfirmReceipt}
          onCancel={() => setReceiptModalOrder(null)}
        />
      )}

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
