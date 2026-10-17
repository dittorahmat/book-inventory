import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, ImageOff, ShieldCheck, ShieldX, X } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import {
  formatNotification,
  type PaymentReviewResult,
  type PaymentReviewRow,
  type PaymentReviewSnapshot,
  type PaymentReviewStatus,
} from "../../lib/payment-review-types";

interface PaymentReviewModalProps {
  heading: string;
  subheading?: string;
  load: () => Promise<PaymentReviewSnapshot>;
  verify: (paymentId: string) => Promise<PaymentReviewResult>;
  reject: (paymentId: string, reason: string) => Promise<PaymentReviewResult>;
  onClose: () => void;
  onChanged?: () => void;
}

const STATUS_BADGE: Record<PaymentReviewStatus, { label: string; className: string }> = {
  pending: { label: "MENUNGGU", className: "bg-amber-100 text-amber-800" },
  verified: { label: "TERVERIFIKASI", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "DITOLAK", className: "bg-red-100 text-red-800" },
};

const newestFirst = (rows: PaymentReviewRow[]): PaymentReviewRow[] =>
  [...rows].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

/**
 * Review bukti pembayaran ortu per order (buku & seragam): status per klaim,
 * Verifikasi, dan Tolak dengan alasan wajib. Aksi selalu memunculkan toast
 * hasil dari `data.notification` (AGENTS.md §5 — dilarang diam).
 */
export function PaymentReviewModal({
  heading,
  subheading,
  load,
  verify,
  reject,
  onClose,
  onChanged,
}: PaymentReviewModalProps) {
  const [snapshot, setSnapshot] = useState<PaymentReviewSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");

  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setSnapshot(await loadRef.current());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat bukti pembayaran.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (paymentId: string, action: "verify" | "reject") => {
    setBusyId(paymentId);
    setActionError(null);
    setToast(null);
    try {
      const result =
        action === "verify" ? await verify(paymentId) : await reject(paymentId, reason.trim());
      setToast(formatNotification(action === "verify" ? "verifikasi" : "tolak", result.notification));
      setRejectFor(null);
      setReason("");
      onChanged?.();
      await refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Aksi gagal diproses. Coba lagi atau hubungi admin."
      );
    } finally {
      setBusyId(null);
    }
  };

  const rows = newestFirst(snapshot?.payments ?? []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review bukti pembayaran"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs sm:items-center"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E4E6EB] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#E4E6EB] px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#050505]">Review Bukti Pembayaran</h3>
            <p className="mt-0.5 truncate font-mono text-xs font-semibold text-[#1877F2]">{heading}</p>
            {subheading ? <p className="truncate text-[11px] text-[#65676B]">{subheading}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-xl p-1.5 text-[#65676B] transition-colors hover:bg-[#F0F2F5] hover:text-[#050505] active:scale-[0.98]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {snapshot ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#E4E6EB] bg-[#F7F8FA] px-5 py-2.5 text-[11px] text-[#65676B]">
            <span>
              Bukti menunggu: <strong className="text-[#050505]">{snapshot.pendingCount}</strong>
            </span>
            {snapshot.remainingAmount !== null ? (
              <span>
                Sisa tagihan:{" "}
                <strong className="text-[#050505]">{formatRupiah(snapshot.remainingAmount)}</strong>
              </span>
            ) : null}
          </div>
        ) : null}

        {toast ? (
          <div
            role="status"
            className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{toast}</span>
          </div>
        ) : null}

        {actionError ? (
          <div
            role="alert"
            className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700"
          >
            {actionError}
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
          >
            {loadError}
            <button
              type="button"
              onClick={() => void refresh()}
              className="ml-2 font-bold underline active:scale-[0.98]"
            >
              Coba lagi
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse space-y-2 rounded-xl border border-[#E4E6EB] p-4">
                <div className="h-3 w-32 rounded-lg bg-[#E4E6EB]" />
                <div className="h-3 w-56 rounded-lg bg-[#E4E6EB]" />
                <div className="h-3 w-40 rounded-lg bg-[#E4E6EB]" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && !loadError && rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-[#65676B]">
            Belum ada bukti pembayaran yang diunggah orang tua untuk order ini.
          </div>
        ) : null}

        {!isLoading && rows.length > 0 ? (
          <div className="divide-y divide-[#E4E6EB]">
            {rows.map((row) => {
              const badge = STATUS_BADGE[row.status];
              const isPending = row.status === "pending";
              const isBusy = busyId === row.id;
              return (
                <div key={row.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5 text-xs">
                      <div className="font-bold text-[#050505]">
                        Nominal transfer: {formatRupiah(row.transferAmount)}
                      </div>
                      <div className="text-[#65676B]">
                        Alokasi order ini: <strong className="text-[#050505]">{formatRupiah(row.allocationAmount)}</strong>
                      </div>
                      <div className="text-[11px] text-[#65676B]">
                        Bank: {row.bankName || "-"} &bull; Ref: {row.referenceNumber || "-"} &bull;{" "}
                        {row.createdAt.slice(0, 10)}
                      </div>
                      {row.notes ? (
                        <div className="text-[11px] text-[#65676B]">Catatan ortu: {row.notes}</div>
                      ) : null}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-2">
                    {row.paymentProofUrl ? (
                      <a
                        href={row.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1877F2] hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Lihat bukti transfer
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#65676B]">
                        <ImageOff className="h-3.5 w-3.5" />
                        Tanpa lampiran bukti
                      </span>
                    )}
                  </div>

                  {row.status === "rejected" ? (
                    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                      Ditolak: {row.rejectReason || "tanpa alasan tercatat"}
                    </div>
                  ) : null}

                  {row.status === "verified" ? (
                    <div className="mt-2 text-[11px] text-emerald-700">
                      Diverifikasi {row.verifiedAt ? row.verifiedAt.slice(0, 10) : ""}
                    </div>
                  ) : null}

                  {isPending && rejectFor !== row.id ? (
                    <div className="mt-3 flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectFor(row.id);
                          setReason("");
                          setActionError(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 active:scale-[0.98]"
                      >
                        <ShieldX className="h-3.5 w-3.5" />
                        Tolak
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void run(row.id, "verify")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98]"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {isBusy ? "Memproses..." : "Verifikasi"}
                      </button>
                    </div>
                  ) : null}

                  {isPending && rejectFor === row.id ? (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label
                          htmlFor={`reject-reason-${row.id}`}
                          className="mb-1 block text-[11px] font-semibold text-[#050505]"
                        >
                          Alasan penolakan (wajib)
                        </label>
                        <input
                          id={`reject-reason-${row.id}`}
                          type="text"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Contoh: nominal transfer tidak sesuai tagihan"
                          className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs text-[#050505]"
                        />
                        <span className="mt-1 block text-[10px] text-[#65676B]">
                          Alasan dikirim ke orang tua lewat notifikasi.
                        </span>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectFor(null);
                            setReason("");
                          }}
                          className="rounded-xl bg-[#F0F2F5] px-3.5 py-2 text-xs font-semibold text-[#050505] transition-colors hover:bg-[#E4E6EB] disabled:opacity-50 active:scale-[0.98]"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={isBusy || reason.trim().length === 0}
                          onClick={() => void run(row.id, "reject")}
                          className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isBusy ? "Menolak..." : "Kirim Penolakan"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex justify-end border-t border-[#E4E6EB] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#F0F2F5] px-4 py-2 text-xs font-semibold text-[#050505] transition-colors hover:bg-[#E4E6EB] active:scale-[0.98]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
