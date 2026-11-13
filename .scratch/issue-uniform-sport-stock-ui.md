## What to build
Menyempurnakan antarmuka tabel katalog seragam (`UniformVariantList.tsx`) dan service katalog agar varian seragam olahraga yang memiliki ukuran (*multi-size*) selalu menampilkan rincian ukuran dan dapat diset stoknya dengan mudah.

1. **Quick-Set Stok Per Ukuran (Mode Demo & Admin)**:
   - Menampilkan tombol override/edit pensil untuk setiap ukuran seragam olahraga (`S: 0 ✏️`, `M: 0 ✏️`, dst.) sehingga admin dapat menyetel stok ukuran tertentu secara langsung dari tabel katalog.
2. **Resilient Stock Fallback**:
   - Jika suatu varian seragam konveksi/olahraga memiliki daftar ukuran terdaftar di `uniform_sizes` namun baris `uniform_stock` belum terisi di database, UI/service otomatis menganggap ukuran tersebut ada dengan stok default 0, sehingga tidak mematikan tombol edit stok.
3. **Pembaruan Guardrail `check:d1-catalog`**:
   - Menambahkan verifikasi jumlah baris `uniform_stock` (minimal mencakup seluruh varian seragam aktif) ke dalam `scripts/check-d1-catalog.ts`.

## Acceptance criteria
- [ ] Tabel katalog seragam (`UniformVariantList.tsx`) merender tombol pensil quick-set untuk masing-masing ukuran olahraga.
- [ ] Varian yang memiliki ukuran namun belum tercatat di database stok menampilkan fallback ukuran dengan stok 0 dan dapat diset.
- [ ] Skrip `check:d1-catalog` memvalidasi kelengkapan baris stok seragam di Cloudflare D1 remote.
- [ ] Unit test komponen (`UniformCatalogSection.test.tsx` / `UniformVariantList.test.tsx`) memverifikasi rendering rincian per-size dan tombol pensilnya.

## Blocked by
- #435
