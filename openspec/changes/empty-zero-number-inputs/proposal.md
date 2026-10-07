## Why

Di berbagai formulir aplikasi (misalnya pengisian harga buku, kuantitas pesanan, diskon, alokasi stok, dan nominal pembayaran kasir/portal), field numerik saat ini mengikat nilai state secara langsung (misal `value={price}` di mana nilai awal adalah `0`). Akibatnya, angka `0` tampil nyata sebagai karakter di dalam kolom input alih-alih placeholder abu-abu. Ketika user langsung mengetik angka baru seperti `150000`, teks yang muncul menjadi `0150000`. Meskipun backend atau parser menyimpan nilai secara benar, tampilan angka 0 di depan ini membingungkan dan mengganggu pengalaman pengguna (UX).

## What Changes

- **Penyelarasan Nilai Input Angka**: Semua input teks bertipe numerik (`type="number"`) yang memiliki nilai `0` akan merender nilai string kosong (`value={val === 0 ? "" : val}` atau melalui helper pembungkus yang konsisten) dan menampilkan placeholder `"0"` (atau placeholder kontekstual yang relevan).
- **Penanganan Input Kosong pada Handler**: Saat kolom dikosongkan oleh user (misalnya dihapus backspace), handler input (`onChange`) secara aman mengonversi nilai kosong menjadi `0` (`parseInt(e.target.value, 10) || 0` atau `Number(e.target.value) || 0`), mencegah nilai `NaN` atau string kosong pada state numerik.
- **Konsistensi UI Seluruh Aplikasi**: Berlaku untuk seluruh form input angka:
  - Input harga & nominal: [BookPriceFields.tsx](file:///D:/development/book-inventory/src/components/catalog/BookPriceFields.tsx), [PaymentStep.tsx](file:///D:/development/book-inventory/src/components/portal/PaymentStep.tsx), [StudentOrdersView.tsx](file:///D:/development/book-inventory/src/views/StudentOrdersView.tsx)
  - Input kuantitas & diskon: [ProcurementView.tsx](file:///D:/development/book-inventory/src/views/ProcurementView.tsx) (Qty Pesan, Harga Satuan, Diskon, Qty Diterima), [OrderItemStep.tsx](file:///D:/development/book-inventory/src/components/portal/OrderItemStep.tsx), [BundlingModal.tsx](file:///D:/development/book-inventory/src/components/BundlingModal.tsx), [PackagesView.tsx](file:///D:/development/book-inventory/src/views/PackagesView.tsx), [StockSummaryTable.tsx](file:///D:/development/book-inventory/src/components/inventory/StockSummaryTable.tsx), [CatalogView.tsx](file:///D:/development/book-inventory/src/views/CatalogView.tsx)
  - Input konfigurasi angka lainnya: [SettingsView.tsx](file:///D:/development/book-inventory/src/views/SettingsView.tsx) (Port SMTP)

## Capabilities

### New Capabilities
- `numeric-input-empty-zero`: Standarisasi perilaku UI untuk input numerik di mana angka `0` ditampilkan sebagai placeholder kosong dan input langsung menggantikan nilai tanpa prefix `0` di depannya.

### Modified Capabilities
- (Tidak ada — belum ada spec utama di `openspec/specs/`; capability di atas didefinisikan sebagai delta baru.)

## Impact

- **Frontend Components & Views**:
  - `src/components/catalog/BookPriceFields.tsx`
  - `src/views/ProcurementView.tsx`
  - `src/views/StudentOrdersView.tsx`
  - `src/components/portal/PaymentStep.tsx`
  - `src/components/portal/OrderItemStep.tsx`
  - `src/components/inventory/StockSummaryTable.tsx`
  - `src/components/BundlingModal.tsx`
  - `src/views/CatalogView.tsx`
  - `src/views/PackagesView.tsx`
  - `src/views/SettingsView.tsx`
- **Backend / API / Database**:
  - Nol perubahan skema database atau kontrak API; payload dan tipe data di state tetap berupa `number`.
- **Breaking Changes**: Tidak ada breaking change. Perubahan ini murni peningkatan UX di layer presentasi formulir.
