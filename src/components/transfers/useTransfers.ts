import { useCallback, useEffect, useState } from "react";
import type { School, TransferShipment } from "../../types";
import { getJson, postJson, delJson } from "../../lib/api";
import {
  buildReceiveShipmentPayload,
  type BundleConditionPick,
  type LooseConditionPick,
} from "../../lib/transfer-pricing";

/** Paruh daftar transfer: muat, rincian, dispatch, terima, hapus. Paruh draf tinggal di useTransferDraft. */
export function useTransfers() {
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
    selectedShipment,
    setSelectedShipment,
    fetchShipments,
    handleDispatch,
    handleReceive,
    handleDeleteShipment,
    openShipmentDetail,
  };
}
