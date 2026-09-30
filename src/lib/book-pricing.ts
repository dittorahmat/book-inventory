/** Harga efektif buku: fallback ke harga dasar bila beli/jual belum diisi (0/undefined). */
export function effectiveBookPrice(book: { price?: number; buyPrice?: number; sellPrice?: number }): {
  buy: number;
  sell: number;
} {
  const base = book.price || 0;
  return {
    buy: book.buyPrice && book.buyPrice > 0 ? book.buyPrice : base,
    sell: book.sellPrice && book.sellPrice > 0 ? book.sellPrice : base,
  };
}

/** Hitung tiga angka PO dari item (qty × harga satuan, diskon persen per item). */
export function calcPoTotals(items: Array<{ quantityOrdered: number; unitPrice: number; discountPercent: number }>): {
  gross: number;
  discount: number;
  net: number;
  totalQty: number;
} {
  let gross = 0;
  let discount = 0;
  let totalQty = 0;
  for (const it of items) {
    const qty = it.quantityOrdered || 0;
    const line = qty * (it.unitPrice || 0);
    gross += line;
    discount += Math.round((line * (it.discountPercent || 0)) / 100);
    totalQty += qty;
  }
  return { gross, discount, net: gross - discount, totalQty };
}
