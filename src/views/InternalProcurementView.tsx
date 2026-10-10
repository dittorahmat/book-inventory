import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { School } from "../types";
import type { StaffRole } from "../components/layout/AppTabsNavigation";
import { isCentralRole } from "../lib/staff-roles";
import { useInternalOrders } from "../components/internal-orders/useInternalOrders";
import { InternalOrdersTable } from "../components/internal-orders/InternalOrdersTable";
import { CreateInternalOrderModal } from "../components/internal-orders/CreateInternalOrderModal";

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
  const filterSchoolId = isCentral ? (activeSchool?.id ?? null) : (userSchoolId ?? activeSchool?.id ?? null);
  const {
    orders,
    isLoading,
    loadError,
    loadData,
    submitOrder,
    shipmentsByOrder,
    shipmentsLoading,
    shipmentsError,
    loadShipments,
  } = useInternalOrders(filterSchoolId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
              Pesanan Cabang
            </span>
            <span className="text-xs text-[#65676B]">&bull; {activeSchool?.name ?? "Semua cabang"}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-[#050505]">Pesan Paket ke Gudang</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-[#65676B]">
            Ajukan kebutuhan paket buku ke gudang pusat, lalu pantau progres pemenuhan dan surat jalan pengirimannya di sini.
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

      <InternalOrdersTable
        orders={orders}
        isLoading={isLoading}
        shipmentsByOrder={shipmentsByOrder}
        shipmentsLoading={shipmentsLoading}
        shipmentsError={shipmentsError}
        onToggleShipments={(orderId, expanded) => {
          if (expanded) loadShipments(orderId);
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
