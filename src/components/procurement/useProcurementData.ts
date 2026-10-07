import { useCallback, useEffect, useState } from "react";
import type { Book } from "../../types";
import type { PurchaseOrder, Supplier } from "./procurement-types";

/** Data pengadaan terpusat: daftar PO, supplier, katalog + koreografi muat ulang. */
export function useProcurementData() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultSupplierId, setDefaultSupplierId] = useState("");

  const loadSuppliers = useCallback(async (): Promise<Supplier[]> => {
    const supRes = await fetch("/api/procurement/suppliers");
    const supData = await supRes.json();
    if (supData.success) {
      setSuppliers(supData.data);
      return supData.data;
    }
    return [];
  }, []);

  const loadPurchaseOrders = useCallback(async (): Promise<PurchaseOrder[] | null> => {
    const poRes = await fetch("/api/procurement/purchase-orders");
    const poData = await poRes.json();
    if (poData.success) {
      setPurchaseOrders(poData.data);
      return poData.data;
    }
    return null;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const booksPromise = fetch("/api/books").then((r) => r.json());
      const [booksData, , list] = await Promise.all([booksPromise, loadPurchaseOrders(), loadSuppliers()]);
      if (booksData.success) setCatalogBooks(booksData.data);
      if (list.length > 0) setDefaultSupplierId((prev) => prev || list[0].id);
    } catch (err) {
      console.error("Failed to load procurement data", err);
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
    defaultSupplierId,
    loadData,
    loadSuppliers,
    loadPurchaseOrders,
  };
}
