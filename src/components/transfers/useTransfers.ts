import { useCallback, useEffect, useState } from "react";
import type { BookItem, School, TransferShipment } from "../../types";
import { buildQuery, getJson, postJson } from "../../lib/api";
import { calcHeaderTotal, formatRupiah } from "../../lib/transfer-pricing";
import { effectiveSellPrice } from "../../lib/book-pricing";
import type { ReadyBundle } from "./PackagePicker";

export type ReceiptCondition = "good" | "damaged" | "missing";

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

  const looseTotal = calcHeaderTotal(
    selectedItems.map((id) => {
      const item = availableItems.find((i) => i.id === id);
      return { unitPriceSnapshot: effectiveSellPrice(item?.book ?? {}), quantity: 1 };
    })
  );
  const packageTotal = calcHeaderTotal(
    selectedPackages.map((id) => {
      const b = bundles.find((x) => x.id === id);
      return { unitPriceSnapshot: b?.packagePrice || 0, quantity: 1 };
    })
  );

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

  useEffect(() => {
    fetchShipments();
    getJson<School[]>("/api/schools", "Gagal memuat daftar sekolah.").then(setAllSchools).catch(() => {});
  }, [fetchShipments]);

  const openShipmentDetail = useCallback(async (id: string) => {
    try {
      setSelectedShipment(await getJson<TransferShipment>(`/api/shipments/${id}`, "Gagal memuat rincian transfer"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat memuat rincian transfer");
    }
  }, []);

  const handleCreateShipment = useCallback(async () => {
    if (!activeSchool || !destinationSchoolId) return;
    if (selectedItems.length === 0 && selectedPackages.length === 0) {
      alert("Pilih minimal 1 buku satuan atau 1 bundel paketan");
      return;
    }
    try {
      const created = await postJson<{ shipmentNumber: string; totalDeclaredValue?: number }>(
        "/api/shipments",
        {
          fromSchoolId: activeSchool.id,
          toSchoolId: destinationSchoolId,
          bookItemIds: selectedItems,
          packageItemIds: selectedPackages,
          reason: transferReason.trim() || undefined,
          notes: "Scheduled distribution",
        },
        "Gagal menyimpan draf transfer"
      );
      alert(`Draf ${created.shipmentNumber} tersimpan! Nilai: ${formatRupiah(created.totalDeclaredValue || 0)}`);
      setIsCreating(false);
      setSelectedItems([]);
      setSelectedPackages([]);
      setTransferReason("");
      await fetchShipments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat menyimpan draf transfer");
    }
  }, [activeSchool, destinationSchoolId, selectedItems, selectedPackages, transferReason, fetchShipments]);

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
      const looseItems = (shipment.items || []).filter((item) => item.itemType !== "package" && item.bookItemId);
      const bundleItems = (shipment.items || []).filter((item) => item.itemType === "package" && item.packageItemId);
      if (looseItems.length === 0 && bundleItems.length === 0) {
        alert("Tidak ada item manifest pada transfer ini");
        return;
      }
      const looseById = new Map((loosePicks ?? []).map((p) => [p.bookItemId, p.condition]));
      const bundleById = new Map((bundlePicks ?? []).map((p) => [p.packageItemId, p.condition]));
      try {
        const data = await postJson<{ status: string }>(
          `/api/shipments/${shipment.id}/receive`,
          {
            itemReceipts: looseItems.map((item) => ({ bookItemId: item.bookItemId as string, condition: looseById.get(item.bookItemId as string) ?? "good" })),
            packageReceipts: bundleItems.map((item) => ({ packageItemId: item.packageItemId as string, condition: bundleById.get(item.packageItemId as string) ?? "good" })),
          },
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

  return {
    shipments,
    allSchools,
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
    openShipmentDetail,
  };
}
