/**
 * Kanonik harga terpusat (dipakai frontend + backend).
 * Satu-satunya tempat aturan fallback harga dan matematika header PO tinggal.
 * Modul ini murni (tanpa dependensi DB) agar aman diimpor dari bundle klien.
 */
export interface PriceLike {
  price?: number | null;
  buyPrice?: number | null;
  sellPrice?: number | null;
}

const num = (v: number | null | undefined): number => v || 0;

/** Harga jual efektif: fallback ke harga lama (`price`) bila harga jual belum pernah diisi. */
export const effectiveSellPrice = (book: PriceLike): number =>
  num(book.sellPrice) > 0 ? book.sellPrice! : num(book.price);

/** Harga beli efektif: fallback ke harga lama (`price`) bila harga beli belum pernah diisi. */
export const effectiveBuyPrice = (book: PriceLike): number =>
  num(book.buyPrice) > 0 ? book.buyPrice! : num(book.price);

/** Harga efektif buku: fallback ke harga dasar bila beli/jual belum diisi (0/undefined). */
export const effectiveBookPrice = (book: PriceLike): { buy: number; sell: number } => ({
  buy: effectiveBuyPrice(book),
  sell: effectiveSellPrice(book),
});

export interface PoLineInput {
  quantityOrdered: number;
  unitPrice: number;
  discountPercent: number;
}

const lineGross = (it: PoLineInput): number => (it.quantityOrdered || 0) * (it.unitPrice || 0);
const lineDiscount = (it: PoLineInput): number => Math.round((lineGross(it) * (it.discountPercent || 0)) / 100);

/** Netto satu baris PO (kotor − diskon). */
export const calcPoLineNet = (it: PoLineInput): number => lineGross(it) - lineDiscount(it);

/** Tiga angka header PO (kotor, diskon, netto). Kanonik agar route + cetak + email konsisten. */
export const calcPoHeader = (items: PoLineInput[]): { subtotalGross: number; discountTotal: number; totalAmount: number } => {
  const subtotalGross = items.reduce((s, it) => s + lineGross(it), 0);
  const discountTotal = items.reduce((s, it) => s + lineDiscount(it), 0);
  return { subtotalGross, discountTotal, totalAmount: subtotalGross - discountTotal };
};
