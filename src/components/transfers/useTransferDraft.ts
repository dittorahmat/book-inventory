import { useCallback, useState } from "react";
import type { BookItem, School } from "../../types";
import { buildQuery, getJson, postJson } from "../../lib/api";
import {
  buildCreateShipmentPayload,
  calcTransferLooseTotal,
  calcTransferPackageTotal,
  formatRupiah,
} from "../../lib/transfer-pricing";
import type { ReadyBundle } from "./PackagePicker";

const toggleIn =
  (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
  (id: string): void =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

/** Paruh draf alur transfer: katalog siap-kirim, seleksi, total, dan pembuatan draf. Murni UI-state + api. */
export function useTransferDraft(
  activeSchool: School | null,
  onCreated?: () => Promise<void> | void
) {
  const [availableItems, setAvailableItems] = useState<BookItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bundles, setBundles] = useState<ReadyBundle[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [destinationSchoolId, setDestinationSchoolId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isInstant, setIsInstant] = useState(false);

  const looseTotal = calcTransferLooseTotal(selectedItems, availableItems);
  const packageTotal = calcTransferPackageTotal(selectedPackages, bundles);

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
      await onCreated?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat menyimpan transfer");
    }
  }, [activeSchool, destinationSchoolId, selectedItems, selectedPackages, transferReason, isInstant, onCreated]);

  return {
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
    looseTotal,
    packageTotal,
    toggleLooseItem: toggleIn(setSelectedItems),
    togglePackageItem: toggleIn(setSelectedPackages),
    loadAvailableItemsForTransfer,
    handleCreateShipment,
  };
}

export type TransferDraft = ReturnType<typeof useTransferDraft>;
