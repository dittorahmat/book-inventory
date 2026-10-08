import { useCallback, useEffect, useState } from "react";
import type { Book } from "../../types";
import { getJson } from "../../lib/api";
import type { PurchaseOrder, Supplier } from "./procurement-types";

/** Data pengadaan terpusat: daftar PO, supplier, katalog + koreografi muat ulang. */
export function useProcurementData() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [defaultSupplierId, setDefaultSupplierId] = useState("");

  const loadSuppliers = useCallback(async (): Promise<Supplier[]> => {
    const list = await getJson<Supplier[]>("/api/procurement/suppliers", "Gagal memuat daftar supplier.");
    setSuppliers(list);
    return list;
  }, []);

  const loadPurchaseOrders = useCallback(async (): Promise<PurchaseOrder[] | null> => {
    const list = await getJson<PurchaseOrder[]>(
      "/api/procurement/purchase-orders",
      "Gagal memuat daftar purchase order."
    );
    setPurchaseOrders(list);
    return list;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [booksData, , list] = await Promise.all([
        getJson<Book[]>("/api/books", "Gagal memuat katalog buku."),
        loadPurchaseOrders(),
        loadSuppliers(),
      ]);
      setCatalogBooks(booksData);
      if (list.length > 0) setDefaultSupplierId((prev) => prev || list[0].id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data pengadaan.");
    } finally {
      setIsLoading(false);
    }
  }, [loadPurchaseOrders, loadSuppliers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    purchaseOrders,
    suppliers,
    catalogBooks,
    isLoading,
    loadError,
    defaultSupplierId,
    loadData,
    loadSuppliers,
    loadPurchaseOrders,
  };
}
