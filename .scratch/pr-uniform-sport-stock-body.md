## Ringkasan Perubahan
PR ini menyelesaikan masalah pada pengelolaan stok seragam olahraga di antarmuka Gudang Seragam dan database Cloudflare D1:

1. **Sinkronisasi Baris Stok Multi-Size ke Remote D1 (closes #435)**:
   - 126 baris saldo stok varian seragam aktif (termasuk seluruh ukuran seragam olahraga S, M, L, XL, 2XL, 3XL, 4XL, 5XL) telah disinkronkan ke Cloudflare D1 remote (`book-inventory-db`).
   - Rincian ukuran dan stok per-size kini tampil utuh di tabel katalog admin (`S: 0`, `M: 0`, dst.) alih-alih hanya `0 unit` kosong.

2. **Quick-Set & Resilient Fallback Stok Per Ukuran (closes #436)**:
   - Di `UniformVariantList.tsx`: Menampilkan tombol override pensil (`QuickSetStockButton`) untuk masing-masing ukuran seragam olahraga (`S: 0 ✏️`, `M: 0 ✏️`, dst.) saat mode demo aktif (baik tampilan desktop maupun mobile).
   - Di `catalog.ts` (`listUniformVariants`): Menambahkan resilient fallback di mana ukuran yang terdaftar pada varian namun belum memiliki baris database otomatis diinisialisasi dengan stok default 0, sehingga tidak pernah mematikan tombol edit stok.
   - Di `scripts/check-d1-catalog.ts`: Memperbarui verifikasi otomatis keberadaan saldo stok seragam (`uniform_stock`) di remote D1.
   - Menambahkan unit test komponen `UniformVariantList.test.tsx` untuk menjamin rendering rincian per-size dan tombol pensilnya.
