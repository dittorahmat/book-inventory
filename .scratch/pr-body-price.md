## Summary

```diff
  PackageBreakdown.tsx
    <div className="text-xs font-semibold text-[#050505] truncate">{item.title}</div>
+   {item.unitPrice !== undefined && item.unitPrice > 0 && (
+     <div className="text-[11px] text-[#65676B]">
+       {formatRupiah(item.unitPrice)}
+       {item.quantity > 1 && ` × ${item.quantity} = ${formatRupiah(item.unitPrice * item.quantity)}`}
+     </div>
+   )}

  public-orders.ts (GET /packages)
    items: p.items.map((it) => ({
      ...
+     unitPrice: effectiveSellPrice(it),
    }))
```

- **Harga Satuan Per Buku**: Di rincian isi paket portal publik (`PackageBreakdown`), harga jual efektif per buku kini tampil di bawah judul buku (misal: `Rp 95.000` atau `Rp 20.000 × 2 = Rp 40.000`).
- **DTO Endpoint `/packages`**: Menambahkan field `unitPrice: effectiveSellPrice(it)` pada daftar item paket publik.
- **Unit Test Komponen & Route**: Menambahkan `PackageBreakdown.test.tsx` dan memperbarui `public-orders.test.ts`.

## Evidence

- **Before:**
  Rincian isi paket hanya menampilkan judul buku dan jumlah eksemplar (`1 eks`), tanpa rincian harga per buku.
- **After:**
  Rincian isi paket menampilkan judul buku, harga jual per buku (`Rp 95.000`, `Rp 750.000`, dsb.), dan jumlah eksemplar.
  Semua test di `PackageBreakdown.test.tsx` dan `public-orders.test.ts` pass 100%.

## Merge Danger

**Door:** two-way

Perubahan aditif pada DTO dan komponen UI.

**Blast Radius:** localized

Hanya mempengaruhi tampilan daftar rincian isi paket di portal publik (`OrderItemStep`, `PaymentStep`, `OrderSuccessStep`).
