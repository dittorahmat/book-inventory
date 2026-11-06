## Deskripsi
Penyederhanaan model persediaan inventaris buku: mengalihkan operasional pelacakan dari serial barcode eksemplar fisik per unit (`book_items`) ke saldo kuantitas agregat (`book_stocks`, `package_stocks`, `stock_adjustments`). Tabel fisik lama tetap dipertahankan sebagai arsip read-only historis (pola expand-contract non-destruktif).

## Perubahan Perilaku
- **Skema & Mutasi Stok Agregat**: Penambahan tabel `book_stocks`, `package_stocks`, dan `stock_adjustments` dengan deep module seam transaksional (`src/server/services/stock/aggregate.ts`).
- **Penerimaan PO Supplier**: Intake Surat Jalan Pemasok langsung memperbarui saldo buku satuan `book_stocks`. Penerimaan barang rusak dicatat sebagai audit log murni (`updateStockBalance: false`) tanpa memotong saldo aktif secara negatif (§0.61).
- **Perakitan & Pembongkaran Bundel Paket**: Operasional kitting paket BOM (`package-assembly.ts`) menambah saldo `package_stocks` dan memotong kuantitas komponen buku lepas di `book_stocks`.
- **Transfer Antarcabang & Handover**: Dokumen pengiriman dan serah-terima paket ke siswa secara konsisten memutasi saldo kuantitas antarlokasi dan cabang.
- **Deprecate Barcode Per Unit**: Rute `bookItemsRouter` ditandai sebagai arsip/read-only legacy; pembacaan stok operasional terpusat di `/api/stock-summary`.
- **Invarian & Guardrail**: Memperbarui aturan arsitektur §3.1 di `AGENTS.md`, menambahkan mandat anti-kambuh §0.61 di `docs/rules/logistics-stock.md`, dan menambahkan guardrail mekanis pada `scripts/check-clean-artifacts.ts` yang melarang file non-migrasi di folder `drizzle/`.

## Verifikasi
- `bun run check:all`: 725 pass, 0 fail, 4126 assertions di seluruh 149 file test suite.
- `bun run check:fast` dan build Vite lolos 100% hijau.
