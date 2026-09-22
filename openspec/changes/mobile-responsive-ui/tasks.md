## 1. Mobile Navigation & Header Structure

- [x] 1.1 Buat komponen `MobileNavBar` tetap di bagian bawah layar smartphone (`fixed bottom-0 z-30 md:hidden`) dengan navigasi jempol dan safe-area padding di [App.tsx](file:///D:/development/book-inventory/src/App.tsx).
- [x] 1.2 Sesuaikan header atas pada viewport mobile di [App.tsx](file:///D:/development/book-inventory/src/App.tsx) agar branch selector dan profil pengguna tampil rapi tanpa meluber keluar layar.
- [x] 1.3 Tambahkan padding bawah pada container konten utama (`pb-24 md:pb-8`) agar konten tidak tertutup bilah navigasi bawah.

## 2. Adaptive Card View for Branch Stock Inventory

- [x] 2.1 Buat komponen kartu adaptif per copy buku (`InventoryItemCard`) untuk viewport `< md` di [InventoryView.tsx](file:///D:/development/book-inventory/src/views/InventoryView.tsx) dengan status badge, detail barcode, dan target sentuh minimal 44x44px.
- [x] 2.2 Sesuaikan kontrol pencarian, filter kondisi, dan pemilihan batch di [InventoryView.tsx](file:///D:/development/book-inventory/src/views/InventoryView.tsx) agar responsif `w-full` di mobile.
- [x] 2.3 Sesuaikan posisi floating batch action bar di [InventoryView.tsx](file:///D:/development/book-inventory/src/views/InventoryView.tsx) menjadi `bottom-16 md:bottom-6` agar tidak menimpa navigasi bawah.

## 3. Adaptive Layouts for Catalog & Transfers

- [x] 3.1 Adaptasi tampilan daftar buku di [CatalogView.tsx](file:///D:/development/book-inventory/src/views/CatalogView.tsx) agar beralih ke format kartu responsif di mobile.
- [x] 3.2 Adaptasi tampilan riwayat pengiriman transfer di [TransfersView.tsx](file:///D:/development/book-inventory/src/views/TransfersView.tsx) agar nyaman dibaca dan di-tap pada layar smartphone.

## 4. Verification & Quality Checks

- [x] 4.1 Jalankan `npm run type-check` dan pastikan nol error TypeScript.
- [x] 4.2 Jalankan `npm run build` untuk memverifikasi bundle frontend dan backend terkompilasi bersih.
- [x] 4.3 Uji tampilan responsif pada resolusi 360px–412px (layar Android standar) untuk memastikan tidak ada overflow horizontal.
