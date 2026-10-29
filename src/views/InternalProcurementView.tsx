import { useState } from "react";
import { Plus, RefreshCw, Send, Truck } from "lucide-react";
import type { School } from "../types";
import type { StaffRole } from "../lib/staff-roles";
import { isCentralRole, isLogisticsRole } from "../lib/staff-roles";
import { CreateInternalShipmentModal } from "../components/internal-orders/CreateInternalShipmentModal";
import { PushDistributionModal } from "../components/internal-orders/PushDistributionModal";
import { InternalShipmentPrintModal } from "../components/internal-orders/InternalShipmentPrintModal";
import type { InternalOrder } from "../lib/internal-orders-types";
import { useInternalOrders } from "../components/internal-orders/useInternalOrders";
import { InternalOrdersTable } from "../components/internal-orders/InternalOrdersTable";
import { CreateInternalOrderModal } from "../components/internal-orders/CreateInternalOrderModal";
import { ReceiveInternalShipmentModal } from "../components/internal-orders/ReceiveInternalShipmentModal";
import type { InternalShipment } from "../lib/internal-orders-types";

interface InternalProcurementViewProps {
  activeSchool: School | null;
  schools: School[];
  userRole: StaffRole;
  userSchoolId: string | null;
}

/** Tab cabang “Pesan ke Gudang”: buat Internal PO paket + pantau pemenuhan gudang. */
export function InternalProcurementView({
  activeSchool,
  schools,
  userRole,
  userSchoolId,
}: InternalProcurementViewProps) {
  const isCentral = isCentralRole(userRole);
  const isLogistics = isLogisticsRole(userRole);
  const filterSchoolId = isCentral ? (activeSchool?.id ?? null) : (userSchoolId ?? activeSchool?.id ?? null);
  const {
    orders,
    isLoading,
    loadError,
    loadData,
    submitOrder,
    submitPoShipment,
    submitManualShipment,
    incomingShipments,
    loadIncomingShipments,
    shipmentsByOrder,
    shipmentsLoading,
    shipmentsError,
    loadShipments,
  } = useInternalOrders(filterSchoolId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isShipmentOpen, setIsShipmentOpen] = useState(false);
  const [isPushOpen, setIsPushOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<{ order: InternalOrder; shipment: InternalShipment } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<{ orderId: string; shipment: InternalShipment } | null>(null);
  const [createSchoolId, setCreateSchoolId] = useState<string | null>(null);
  const effectiveCreateSchoolId = isCentral
    ? (createSchoolId ?? activeSchool?.id ?? schools[0]?.id ?? "")
    : (userSchoolId ?? activeSchool?.id ?? "");
  const createSchoolName =
    schools.find((s) => s.id === effectiveCreateSchoolId)?.name ?? activeSchool?.name ?? "Cabang Anda";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E4E6EB] bg-white p-5 shadow-xs md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              {isLogistics ? "Pengiriman Cabang" : "Pesanan Cabang"}
            </span>
            <span className="text-xs text-[#65676B]">&bull; {activeSchool?.name ?? "Semua cabang"}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-[#050505]">
            {isLogistics ? "Kirim Paket Ke Cabang" : "Terima Paket Dari Gudang"}
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-[#65676B]">
            {isLogistics
              ? "Kirim stok paket buku ke cabang dan pantau status surat jalan pengiriman di sini."
              : "Ajukan kebutuhan paket buku ke gudang pusat, lalu pantau progres pemenuhan dan surat jalan pengirimannya di sini."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => loadData()}
            title="Muat ulang data"
            className="rounded-xl border border-[#CED0D4] p-2.5 text-[#65676B] transition-colors hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          {isLogistics && (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setIsPushOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-2xs transition-colors hover:bg-emerald-100 active:scale-[0.98]"
            >
              <Send className="h-4 w-4" />
              <span>Push Distribution Awal Tahun</span>
            </button>
          )}
          {isLogistics && (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setIsShipmentOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#1877F2] bg-white px-3.5 py-2 text-xs font-semibold text-[#1877F2] shadow-2xs transition-colors hover:bg-blue-50 active:scale-[0.98]"
            >
              <Truck className="h-4 w-4" />
              <span>Buat Surat Jalan</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setCreateSchoolId(effectiveCreateSchoolId || null);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#1877F2] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#166FE5] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Pesanan</span>
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          {notice}
        </p>
      )}

      {loadError && !isLoading && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => loadData()}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold hover:bg-red-100/50 active:scale-[0.98]"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Banner Kiriman Surat Jalan Rutin / Masuk (khusus role cabang) */}
      {!isLogistics && incomingShipments.filter((s) => s.status === "in_transit").length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Kiriman Surat Jalan dari Gudang ({incomingShipments.filter((s) => s.status === "in_transit").length} sedang dalam perjalanan)
              </h2>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {incomingShipments
              .filter((s) => s.status === "in_transit")
              .map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#050505]">{s.deliveryNoteNumber}</span>
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        {s.internalPoId ? "Berdasarkan PO" : "Pengiriman Rutin"}
                      </span>
                      <span className="text-[11px] text-[#65676B]">{s.shippedDate ?? s.createdAt.slice(0, 10)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#65676B]">
                      {s.items?.map((it) => `${it.packageName ?? it.bookTitle ?? "Paket"} × ${it.quantity}`).join(" · ") || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiveTarget({ orderId: s.internalPoId ?? "", shipment: s })}
                    className="shrink-0 rounded-lg bg-[#1877F2] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#166FE5] active:scale-[0.98]"
                  >
                    Terima Barang
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      <InternalOrdersTable
        orders={orders}
        isLoading={isLoading}
        shipmentsByOrder={shipmentsByOrder}
        shipmentsLoading={shipmentsLoading}
        shipmentsError={shipmentsError}
        onToggleShipments={(orderId, expanded) => {
          if (expanded) loadShipments(orderId);
        }}
        onReceiveShipment={(orderId, shipment) => setReceiveTarget({ orderId, shipment })}
        onPrintShipment={(order, shipment) => setPrintTarget({ order, shipment })}
      />

      {receiveTarget && (
        <ReceiveInternalShipmentModal
          shipment={receiveTarget.shipment}
          onClose={() => setReceiveTarget(null)}
          onReceived={async () => {
            if (receiveTarget.orderId) {
              await loadShipments(receiveTarget.orderId);
            }
            await loadIncomingShipments();
            setNotice(`SJ Internal ${receiveTarget.shipment.deliveryNoteNumber} diterima cabang.`);
          }}
        />
      )}

      {printTarget && (
        <InternalShipmentPrintModal
          shipment={printTarget.shipment}
          poNumber={printTarget.order.poNumber}
          destinationSchoolName={printTarget.order.schoolName}
          onClose={() => setPrintTarget(null)}
        />
      )}

      {isShipmentOpen && (
        <CreateInternalShipmentModal
          schoolOptions={schools.map((s) => ({ id: s.id, name: s.name }))}
          onSubmitPoShipment={submitPoShipment}
          onSubmitManualShipment={submitManualShipment}
          onClose={() => setIsShipmentOpen(false)}
          onCreated={(deliveryNoteNumber) => setNotice(`Surat Jalan ${deliveryNoteNumber} berhasil diterbitkan.`)}
        />
      )}

      <PushDistributionModal
        isOpen={isPushOpen}
        onClose={() => setIsPushOpen(false)}
        schools={schools}
        onSuccess={() => {
          setNotice("Surat Jalan Push Distribution berhasil diterbitkan.");
          loadData();
        }}
      />

      {isCreateOpen && (
        <CreateInternalOrderModal
          schoolId={effectiveCreateSchoolId}
          schoolName={createSchoolName}
          schoolOptions={schools.map((s) => ({ id: s.id, name: s.name }))}
          canChooseSchool={isCentral}
          onSchoolChange={setCreateSchoolId}
          onSubmit={submitOrder}
          onClose={() => setIsCreateOpen(false)}
          onCreated={(poNumber) => setNotice(`Pesanan ${poNumber} terkirim ke gudang pusat.`)}
        />
      )}
    </div>
  );
}
