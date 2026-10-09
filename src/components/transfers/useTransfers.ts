import { useCallback, useEffect, useState } from "react";
import type { BookItem, School, TransferShipment } from "../../types";
import { buildQuery, getJson, postJson, delJson } from "../../lib/api";
import {
  buildCreateShipmentPayload,
  buildReceiveShipmentPayload,
  calcTransferLooseTotal,
  calcTransferPackageTotal,
  formatRupiah,
  type ReceiptCondition,
} from "../../lib/transfer-pricing";
import type { ReadyBundle } from "./PackagePicker";

export type { ReceiptCondition } from "../../lib/transfer-pricing";

export interface LooseConditionPick {
  bookItemId: string;
  condition: ReceiptCondition;
}

export interface BundleConditionPick {
  packageItemId: string;
  condition: ReceiptCondition;
}

const toggleIn =
  (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
  (id: string): void =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

/** Data transfer antar-sekolah: daftar, katalog siap-kirim, seleksi, dan aksi draf/dispatch/receive. */
export function useTransfers(activeSchool: School | null) {
  const [shipments, setShipments] = useState<TransferShipment[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [availableItems, setAvailableItems] = useState<BookItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bundles, setBundles] = useState<ReadyBundle[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [destinationSchoolId, setDestinationSchoolId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<TransferShipment | null>(null);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

  const looseTotal = calcTransferLooseTotal(selectedItems, availableItems);
  const packageTotal = calcTransferPackageTotal(selectedPackages, bundles);

  const fetchShipments = useCallback(async () => {
    try {
      setShipments(await getJson<TransferShipment[]>("/api/shipments", "Gagal memuat daftar transfer"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memuat transfer");
    }
  }, []);

  const loadAvailableItemsForTransfer = useCallback(async () => {
    if (!activeSchool) return;
    try {
      const [loose, ready] = await Promise.all([
        getJson<BookItem[]>(
          buildQuery("/api/book-items", { schoolId: activeSchool.id, status: "in_stock" }),
          "Gagal memuat stok satuan"
        ),
        getJson<ReadyBundle[]>(
          buildQuery("/api/packages/items/ready", { schoolId: activeSchool.id }),
          "Gagal memuat bundel ready"
        ),
      ]);
      setAvailableItems(loose);
      setBundles(ready);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memuat stok");
    }
  }, [activeSchool]);

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

  const [isInstant, setIsInstant] = useState(false);

  const handleCreateShipment = useCallback(async () => {
    if (!activeSchool || !destinationSchoolId) return;
    let payload: ReturnType<typeof buildCreateShipmentPayload>;
    try {
      payload = buildCreateShipmentPayload({
        fromSchoolId: activeSchool.id,
        toSchoolId: destinationSchoolId,
        bookItemIds: selectedItems,
        packageItemIds: selectedPackages,
        reason: transferReason,
        instant: isInstant,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Pilih minimal 1 buku satuan atau 1 bundel paketan");
      return;
    }
    try {
      const created = await postJson<{ shipmentNumber: string; totalDeclaredValue?: number }>(
        "/api/shipments",
        payload,
        "Gagal menyimpan transfer"
      );
      alert(
        isInstant
          ? `Transfer ${created.shipmentNumber} berhasil! Stok langsung dipindahkan ke sekolah tujuan.`
          : `Draf ${created.shipmentNumber} tersimpan! Nilai: ${formatRupiah(created.totalDeclaredValue || 0)}`
      );
      setIsCreating(false);
      setIsInstant(false);
      setSelectedItems([]);
      setSelectedPackages([]);
      setTransferReason("");
      await fetchShipments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat menyimpan transfer");
    }
  }, [activeSchool, destinationSchoolId, selectedItems, selectedPackages, transferReason, isInstant, fetchShipments]);

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
    availableItems,
    selectedItems,
    bundles,
    selectedPackages,
    destinationSchoolId,
    setDestinationSchoolId,
    transferReason,
    setTransferReason,
    isCreating,
    setIsCreating,
    isInstant,
    setIsInstant,
    selectedShipment,
    setSelectedShipment,
    looseTotal,
    packageTotal,
    toggleLooseItem: toggleIn(setSelectedItems),
    togglePackageItem: toggleIn(setSelectedPackages),
    fetchShipments,
    loadAvailableItemsForTransfer,
    handleCreateShipment,
    handleDispatch,
    handleReceive,
    handleDeleteShipment,
    openShipmentDetail,
  };
}
