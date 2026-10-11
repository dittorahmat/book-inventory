import { useCallback, useEffect, useState } from "react";
import type { School, TransferShipment } from "../../types";
import { getJson, postJson, delJson } from "../../lib/api";
import {
  buildReceiveShipmentPayload,
  type ReceiptCondition,
} from "../../lib/transfer-pricing";
import { useTransferDraft } from "./useTransferDraft";

export type { ReceiptCondition } from "../../lib/transfer-pricing";

export interface LooseConditionPick {
  bookItemId: string;
  condition: ReceiptCondition;
}

export interface BundleConditionPick {
  packageItemId: string;
  condition: ReceiptCondition;
}

/** Komposer tipis (bentuk return identik seperti sebelumnya): paruh daftar + paruh draf. */
export function useTransfers(activeSchool: School | null) {
  const [shipments, setShipments] = useState<TransferShipment[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<TransferShipment | null>(null);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

  const fetchShipments = useCallback(async () => {
    try {
      setShipments(await getJson<TransferShipment[]>("/api/shipments", "Gagal memuat daftar transfer"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memuat transfer");
    }
  }, []);

  const fetchSchools = useCallback(async () => {
    try {
      setSchoolsError(null);
      setAllSchools(await getJson<School[]>("/api/schools", "Gagal memuat daftar sekolah."));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memuat sekolah";
      setSchoolsError(message);
      alert(message);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
    fetchSchools();
  }, [fetchShipments, fetchSchools]);

  const openShipmentDetail = useCallback(async (id: string) => {
    try {
      setSelectedShipment(await getJson<TransferShipment>(`/api/shipments/${id}`, "Gagal memuat rincian transfer"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memuat rincian transfer");
    }
  }, []);

  const draft = useTransferDraft(activeSchool, fetchShipments);

  const handleDispatch = useCallback(
    async (id: string) => {
      try {
        await postJson(`/api/shipments/${id}/dispatch`, {}, "Gagal melakukan dispatch pengiriman");
        alert("Pengiriman transfer berhasil di-dispatch!");
        await fetchShipments();
        if (selectedShipment?.id === id) await openShipmentDetail(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat dispatch pengiriman");
      }
    },
    [fetchShipments, openShipmentDetail, selectedShipment?.id]
  );

  const handleReceive = useCallback(
    async (shipment: TransferShipment, loosePicks?: LooseConditionPick[], bundlePicks?: BundleConditionPick[]) => {
      let payload: ReturnType<typeof buildReceiveShipmentPayload>;
      try {
        payload = buildReceiveShipmentPayload(shipment.items || [], loosePicks ?? [], bundlePicks ?? []);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Tidak ada item manifest pada transfer ini");
        return;
      }
      try {
        const data = await postJson<{ status: string }>(
          `/api/shipments/${shipment.id}/receive`,
          payload,
          "Gagal mengonfirmasi penerimaan transfer"
        );
        alert(
          data.status === "completed_with_discrepancy"
            ? "Penerimaan dicatat dengan selisih (rusak/hilang). Periksa status shipment."
            : "Penerimaan transfer berhasil dikonfirmasi! Stok buku telah dialokasikan ke cabang ini."
        );
        await fetchShipments();
        await openShipmentDetail(shipment.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Terjadi kesalahan sistem saat konfirmasi penerimaan transfer");
      }
    },
    [fetchShipments, openShipmentDetail]
  );

  const handleDeleteShipment = useCallback(
    async (id: string) => {
      try {
        await delJson(`/api/shipments/${id}`, "Gagal menghapus pengiriman transfer");
        alert("Pengiriman transfer berhasil dihapus");
        if (selectedShipment?.id === id) setSelectedShipment(null);
        await fetchShipments();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Terjadi kesalahan sistem saat menghapus transfer");
      }
    },
    [fetchShipments, selectedShipment?.id]
  );

  return {
    shipments,
    allSchools,
    schoolsError,
    fetchSchools,
    availableItems: draft.availableItems,
    selectedItems: draft.selectedItems,
    bundles: draft.bundles,
    selectedPackages: draft.selectedPackages,
    destinationSchoolId: draft.destinationSchoolId,
    setDestinationSchoolId: draft.setDestinationSchoolId,
    transferReason: draft.transferReason,
    setTransferReason: draft.setTransferReason,
    isCreating: draft.isCreating,
    setIsCreating: draft.setIsCreating,
    isInstant: draft.isInstant,
    setIsInstant: draft.setIsInstant,
    selectedShipment,
    setSelectedShipment,
    looseTotal: draft.looseTotal,
    packageTotal: draft.packageTotal,
    toggleLooseItem: draft.toggleLooseItem,
    togglePackageItem: draft.togglePackageItem,
    fetchShipments,
    loadAvailableItemsForTransfer: draft.loadAvailableItemsForTransfer,
    handleCreateShipment: draft.handleCreateShipment,
    handleDispatch,
    handleReceive,
    handleDeleteShipment,
    openShipmentDetail,
  };
}
