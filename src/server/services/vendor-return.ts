/**
 * Perencana murni retur ke supplier (RTV): dari kandidat baris stok yang
 * sudah dibaca, pilih yang layak di-dispose. Satu-satunya pemilik idiom
 * dispose (filter in_stock + potong sejumlah kuantitas) agar route dan
 * test mengeksekusi tepat satu aturan yang sama.
 */
export interface VendorReturnDisposeCandidate {
  id: string;
  status: string;
}

/** ID eksemplar yang akan di-dispose: hanya in_stock, maksimal quantity. */
export const planVendorReturnDispose = (
  candidates: VendorReturnDisposeCandidate[],
  quantity: number
): string[] =>
  candidates.filter((c) => c.status === "in_stock").slice(0, Math.max(0, quantity)).map((c) => c.id);
