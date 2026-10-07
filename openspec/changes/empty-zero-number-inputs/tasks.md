## 1. Input Harga & Nominal Pembayaran

- [x] 1.1 Perbarui `BookPriceFields.tsx` (Harga Dasar, Harga Beli, Harga Jual) agar merender `value={val === 0 ? "" : val}` dengan `placeholder="0"` dan verifikasi input dapat diketik langsung tanpa prefix 0
- [x] 1.2 Perbarui `PaymentStep.tsx` pada form portal pembayaran (Nominal Transfer dan Alokasi Buku) agar merender string kosong saat bernilai 0 dan verifikasi pengetikan nominal
- [x] 1.3 Perbarui `StudentOrdersView.tsx` pada modal bayar kasir (Nominal Transfer dan Alokasi Buku) agar merender string kosong saat bernilai 0 dan verifikasi nominal kasir

## 2. Input Kuantitas Pesanan, Diskon, & Penerimaan PO

- [x] 2.1 Perbarui `ProcurementView.tsx` pada form item PO (Qty Pesan, Harga Satuan, Diskon) dan modal terima PO (Qty Diterima) agar merender string kosong saat 0 dan verifikasi perhitungan subtotal tetap akurat
- [x] 2.2 Perbarui `OrderItemStep.tsx` pada input Qty pesanan siswa agar merender string kosong saat 0 dan verifikasi sinkronisasi state keranjang
- [x] 2.3 Perbarui `BundlingModal.tsx` dan `PackagesView.tsx` pada input Qty buku paket/bundling agar merender string kosong saat 0 dan verifikasi kalkulasi paket

## 3. Input Inventaris, Barcode Generator, & Pengaturan Sistem

- [x] 3.1 Perbarui `StockSummaryTable.tsx` pada input Qty transfer / alokasi stok agar merender string kosong saat 0
- [x] 3.2 Perbarui `CatalogView.tsx` pada input jumlah generate barcode agar merender string kosong saat 0
- [x] 3.3 Perbarui `SettingsView.tsx` pada input port SMTP agar merender string kosong saat 0
- [x] 3.4 Jalankan pemeriksaan kualitas lint dan type-check (`npm run type-check && npm run lint`) serta build (`npm run build`) untuk memverifikasi tidak ada regresi tipe data
