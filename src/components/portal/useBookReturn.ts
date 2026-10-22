import { useState } from "react";
import { lookupReturnableOrders } from "./portal-api";
import type { PortalOrderLookup } from "../../lib/portal-types";

/** Ambang minimum pencarian: sama dengan batas server (`lookup-order`). */
export const BOOK_RETURN_MIN_QUERY = 3;

/**
 * State pencarian pesanan untuk tab Refund Buku. Hanya pesanan yang sudah
 * diserahkan (`picked_up`) yang boleh diajukan; sisanya tetap ditampilkan
 * dengan alasan agar ortu tahu kenapa belum bisa direfund.
 */
export function useBookReturn() {
  const [schoolId, setSchoolId] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<PortalOrderLookup[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PortalOrderLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSearched(false);
    if (!schoolId) {
      setError("Pilih cabang / sekolah terlebih dahulu.");
      return;
    }
    if (query.trim().length < BOOK_RETURN_MIN_QUERY) {
      setError(`Masukkan minimal ${BOOK_RETURN_MIN_QUERY} karakter NIS, nama, atau nomor pesanan.`);
      return;
    }
    setSearching(true);
    try {
      setOrders(await lookupReturnableOrders(query, schoolId));
      setSearched(true);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Gagal mencari pesanan.");
    } finally {
      setSearching(false);
    }
  };

  const selectOrder = (order: PortalOrderLookup) => {
    setSelectedOrder(order);
    setError(null);
  };

  const reset = () => {
    setSelectedOrder(null);
    setQuery("");
    setOrders([]);
    setSearched(false);
    setError(null);
  };

  return {
    schoolId,
    setSchoolId,
    query,
    setQuery,
    searching,
    searched,
    orders,
    selectedOrder,
    selectOrder,
    setSelectedOrder,
    error,
    setError,
    handleSearch,
    reset,
  };
}
