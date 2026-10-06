/** Harga efektif buku: fallback ke harga dasar bila beli/jual belum diisi (0/undefined). */
export const effectiveBookPrice = (book: { price?: number; buyPrice?: number; sellPrice?: number }) => ({ buy: (book.buyPrice ?? 0) > 0 ? book.buyPrice! : book.price || 0, sell: (book.sellPrice ?? 0) > 0 ? book.sellPrice! : book.price || 0 });

/** Hitung tiga angka PO dari item (qty × harga satuan, diskon persen per item). */
export const calcPoTotals = (items: Array<{ quantityOrdered: number; unitPrice: number; discountPercent: number }>) =>
  items.reduce(
    (a, it) => {
      const line = (it.quantityOrdered || 0) * (it.unitPrice || 0);
      const d = Math.round((line * (it.discountPercent || 0)) / 100);
      return { gross: a.gross + line, discount: a.discount + d, net: a.gross + line - (a.discount + d), totalQty: a.totalQty + (it.quantityOrdered || 0) };
    },
    { gross: 0, discount: 0, net: 0, totalQty: 0 }
  );
