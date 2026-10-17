import { useCallback, useEffect, useState } from "react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { PaymentReviewModal } from "../orders/PaymentReviewModal";
import { formatRupiah } from "../../lib/transfer-pricing";
import { formatNotification } from "../../lib/payment-review-types";
import { fetchUniformOrders, markUniformShipped, saveUniformShipping, sendUniformInvoice, resolveUniformScholarship, downloadUniformCsv, importUniformShipping, fetchUniformOrderPayments, verifyUniformPayment, rejectUniformPayment, payUniformOrder, type UniformOrderRow } from "./uniform-admin-api";

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
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [ongkirFor, setOngkirFor] = useState<string | null>(null);
  const [ongkirCost, setOngkirCost] = useState("");
  const [ongkirResi, setOngkirResi] = useState("");
  const [paidOnly, setPaidOnly] = useState(true);
  const [importText, setImportText] = useState("");
  const [importShipped, setImportShipped] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [reviewRow, setReviewRow] = useState<UniformOrderRow | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payTransfer, setPayTransfer] = useState("");
  const [payAllocation, setPayAllocation] = useState("");
  const [payBank, setPayBank] = useState("TUNAI");
  const [payBusyId, setPayBusyId] = useState<string | null>(null);
  const [payResult, setPayResult] = useState<string | null>(null);

const parseImportCsv = (text: string): Array<{ nis: string; resi?: string; ongkir?: number }> => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = lines[0]?.toLowerCase().startsWith("nis") ? lines.slice(1) : lines;
  return rows.map((line) => {
    const [nis = "", resi = "", ongkir = ""] = line.split(/[;\t,]/).map((c) => c.trim());
    return { nis, resi: resi || undefined, ongkir: ongkir ? Number(ongkir) || 0 : 0 };
  }).filter((r) => r.nis);
};

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchUniformOrders({ schoolId: schoolId || undefined, shipmentStatus: status || undefined, search: search.trim() || undefined }));
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

  const handleSaveOngkir = async (id: string) => {
    setError(null);
    try {
      await saveUniformShipping(id, parseInt(ongkirCost) || 0, ongkirResi.trim() || undefined);
      setOngkirFor(null);
      setOngkirCost("");
      setOngkirResi("");
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
      setError(err instanceof Error ? err.message : "Gagal memproses beasiswa.");
    }
  };

  const handlePay = async (id: string) => {
    setPayBusyId(id);
    setError(null);
    setPayResult(null);
    try {
      const res = await payUniformOrder(id, {
        transferAmount: parseInt(payTransfer) || 0,
        allocationAmount: parseInt(payAllocation) || 0,
        bankName: payBank.trim() || "TUNAI",
      });
      setPayResult(formatNotification("verifikasi", res.notification));
      setPayFor(null);
      setPayTransfer("");
      setPayAllocation("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat pembayaran seragam.");
    } finally {
      setPayBusyId(null);
    }
  };

  const handleExport = async (format: "packing" | "ekspedisi") => {
    setError(null);
    try {
      if (!schoolId) {
        setError("Pilih sekolah dulu untuk mengunduh data.");
        return;
      }
      await downloadUniformCsv({ schoolId, format, paidOnly });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh data.");
    }
  };

  const handleImport = async () => {
    const rows = parseImportCsv(importText);
    if (rows.length === 0 || !schoolId) {
      setError("Isi data CSV (nis;resi;ongkir) dan pilih sekolah.");
      return;
    }
    setImportBusy(true);
    setError(null);
    setImportResult(null);
    try {
      const res = await importUniformShipping({ schoolId, markShipped: importShipped, rows });
      setImportResult(`${res.updated.length} diperbarui, ${res.rejected.length} ditolak${res.rejected.length > 0 ? `: ${res.rejected.map((r) => `${r.nis} (${r.reason})`).join("; ")}` : ""}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor data.");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 grid gap-3 sm:grid-cols-4">
        <div>
          <SearchableSingleSelect
            label="Sekolah"
            options={schools.map((s) => ({ value: s.id, label: s.name }))}
            value={schoolId}
            onChange={setSchoolId}
            placeholder="Semua sekolah"
            disabled={!!lockedSchoolId}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Unduh data lunas (CSV)</label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => handleExport("packing")} className="px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]">Packing</button>
            <button type="button" onClick={() => handleExport("ekspedisi")} className="px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]">Ekspedisi</button>
          </div>
          <label className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-[#65676B] cursor-pointer">
            <input type="checkbox" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} />
            <span>Hanya yang sudah bayar</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#050505] mb-1">Import ekspedisi (nis;resi;ongkir per baris)</label>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={2} placeholder={"NIS123;RESI-1;18000"} className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs" />
          <div className="flex items-center gap-2 mt-1.5">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-[#65676B] cursor-pointer">
              <input type="checkbox" checked={importShipped} onChange={(e) => setImportShipped(e.target.checked)} />
              <span>Tandai terkirim</span>
            </label>
            <button type="button" disabled={importBusy} onClick={handleImport} className="px-3 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 active:scale-[0.98]">
              {importBusy ? "Mengimpor..." : "Import"}
            </button>
          </div>
          {importResult && <p className="text-[11px] text-[#65676B] mt-1">{importResult}</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 grid gap-3 sm:grid-cols-4">
        <div>
          <SearchableSingleSelect
            label="Status kirim"
            options={[
              { value: "belum_dikirim", label: "Belum terkirim" },
              { value: "sudah_dikirim", label: "Sudah terkirim" },
              { value: "", label: "Semua" },
            ]}
            value={status}
            onChange={setStatus}
            placeholder="Pilih status..."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#050505] mb-1">Cari (nama/NIS/nomor)</label>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Perlu filter sekolah"
              className="flex-1 rounded-xl border border-[#CED0D4] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
            >
              Cari
            </button>
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

      <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
        {loading && <div className="px-4 py-6 text-center text-xs text-[#65676B]">Memuat…</div>}
        {!loading && rows.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-[#65676B]">
            Tidak ada order pada filter ini. Order baru muncul setelah ortu memesan via portal seragam.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{r.studentName} <span className="font-normal text-[#65676B]">· {r.nis}</span></div>
              <div className="text-xs text-[#65676B]">{r.orderNumber} · {r.schoolName} · {formatRupiah(r.totalAmount)}</div>
              <div className="text-xs text-[#65676B] truncate">{r.homeAddressSnapshot}</div>
              <div className="text-xs text-[#65676B]">Ongkir: {r.shippingCost ? formatRupiah(r.shippingCost) : "-"} · Invoice: {r.invoiceSentAt ? "terkirim" : "belum"}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.shipmentStatus === "sudah_dikirim" ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Terkirim{r.shippedAt ? ` · ${r.shippedAt.slice(0, 10)}` : ""}</span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">Belum terkirim</span>
                )}
                {r.stage && (
                  <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full">
                    {r.stage === "pemesanan" ? "Pemesanan" : r.stage === "tagihan" ? "Tagihan masuk" : r.stage === "konfirmasi" ? "Konfirmasi bayar" : "Lunas"}
                  </span>
                )}
                {r.orderType === "scholarship" && (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">Beasiswa</span>
                )}
                {(r.pendingCount ?? 0) > 0 && (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                    Bukti bayar menunggu ({r.pendingCount})
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 flex flex-col gap-1.5">
              {ongkirFor === r.id ? (
                <div className="flex flex-col gap-1">
                  <input value={ongkirCost} onChange={(e) => setOngkirCost(e.target.value)} type="number" min={0} placeholder="Ongkir Rp" className="w-32 rounded-xl border border-[#CED0D4] px-2 py-1 text-xs" />
                  <input value={ongkirResi} onChange={(e) => setOngkirResi(e.target.value)} placeholder="Resi (opsional)" className="w-32 rounded-xl border border-[#CED0D4] px-2 py-1 text-xs" />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => handleSaveOngkir(r.id)} className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-semibold active:scale-[0.98]">Simpan</button>
                    <button type="button" onClick={() => setOngkirFor(null)} className="px-3 py-1 bg-[#F0F2F5] rounded-xl text-xs font-semibold active:scale-[0.98]">Batal</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setOngkirFor(r.id); setOngkirCost(String(r.shippingCost ?? "")); setOngkirResi(r.shippingResi ?? ""); }} className="px-4 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]">
                  Input Ongkir
                </button>
              )}
              {(r.shippingCost ?? 0) > 0 && (
                <button type="button" onClick={() => handleInvoice(r.id, r.studentName)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 active:scale-[0.98]">
                  {r.invoiceSentAt ? "Kirim Ulang" : "Kirim Invoice"}
                </button>
              )}
              {r.paymentStatus === "scholarship_pending" && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleScholarship(r.id, "approve")} className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold active:scale-[0.98]">Setujui</button>
                  <button type="button" onClick={() => handleScholarship(r.id, "reject")} className="px-3 py-2 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold active:scale-[0.98]">Tolak</button>
                </div>
              )}
              {(r.pendingCount ?? 0) > 0 && (
                <button type="button" onClick={() => setReviewRow(r)} className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold hover:bg-amber-100 active:scale-[0.98]">
                  Verifikasi Bukti ({r.pendingCount})
                </button>
              )}
              {payFor === r.id ? (
                <div className="flex w-44 flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#050505]">Nominal transfer (Rp)</label>
                  <input type="number" min={1} value={payTransfer} onChange={(e) => setPayTransfer(e.target.value)} className="rounded-xl border border-[#CED0D4] px-2 py-1 text-xs" />
                  <label className="text-[11px] font-semibold text-[#050505]">Alokasi tagihan (Rp)</label>
                  <input type="number" min={1} value={payAllocation} onChange={(e) => setPayAllocation(e.target.value)} className="rounded-xl border border-[#CED0D4] px-2 py-1 text-xs" />
                  <label className="text-[11px] font-semibold text-[#050505]">Bank / metode</label>
                  <input value={payBank} onChange={(e) => setPayBank(e.target.value)} className="rounded-xl border border-[#CED0D4] px-2 py-1 text-xs" />
                  <div className="flex gap-1">
                    <button type="button" disabled={payBusyId === r.id} onClick={() => handlePay(r.id)} className="px-3 py-1 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 active:scale-[0.98]">Simpan</button>
                    <button type="button" onClick={() => setPayFor(null)} className="px-3 py-1 bg-[#F0F2F5] rounded-xl text-xs font-semibold active:scale-[0.98]">Batal</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setPayFor(r.id); setPayTransfer(""); setPayAllocation(""); setPayBank("TUNAI"); setPayResult(null); }} className="px-4 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]">
                  Input Bayar
                </button>
              )}
              {r.shipmentStatus === "belum_dikirim" && (
                <button
                  type="button"
                  disabled={shippingId === r.id}
                  onClick={() => handleShip(r.id)}
                  className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
                >
                  {shippingId === r.id ? "…" : "Tandai Terkirim"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

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
    </div>
  );
}
