# Tasks: simplify-book-prices-and-po-sync

## 1. Katalog Buku - Penyederhanaan Form Harga

- [x] 1.1 Hapus input "Harga Dasar (Rp)" dari `src/components/catalog/BookPriceFields.tsx` sehingga hanya menyisakan kolom "Harga Beli (Rp)" dan "Harga Jual (Rp)", serta perbarui helper teks dan props bila diperlukan. Verifikasi komponen ter-render rapi tanpa error lint.
- [x] 1.2 Sesuaikan form submit/update buku di `src/views/CatalogView.tsx` agar nilai `price` otomatis diselaraskan dengan `sellPrice || buyPrice || 0` saat membuat atau mengubah buku. Verifikasi buku dapat disimpan dengan sukses.

## 2. Purchase Order (PO) - Otomatisasi & Penguncian Harga Satuan

- [x] 2.1 Perbarui `handleUpdatePOItem` di `src/views/ProcurementView.tsx` agar saat `field === "bookId"`, nilai `unitPrice` otomatis diisi dengan `defaultBuyPrice(newBookId, 0)`.
- [x] 2.2 Perbarui `handleAddPOItemRow` di `src/views/ProcurementView.tsx` agar item baru yang ditambahkan menggunakan `defaultBuyPrice` dari buku yang dipilih secara tepat.
- [x] 2.3 Ubah elemen input `unitPrice` di modal pembuatan PO `src/views/ProcurementView.tsx` menjadi `readOnly` dengan styling Tailwind yang menunjukkan status terkunci (misalnya latar belakang `#F0F2F5`, teks `#65676B`, `cursor-not-allowed`). Verifikasi input tidak dapat diedit manual dan berubah otomatis saat dropdown judul buku diganti.

## 3. Verifikasi & Regression Quality Gate

- [x] 3.1 Jalankan type check (`npm run type-check`) dan lint (`npm run lint`) untuk memastikan zero TypeScript error.
- [x] 3.2 Jalankan unit dan integration tests (`bun test`) untuk memastikan route katalog dan PO tetap lulus 100%.
- [x] 3.3 Jalankan pemeriksaan ukuran berkas (`bun run check:file-size`) dan pastikan seluruh gate terpenuhi.
