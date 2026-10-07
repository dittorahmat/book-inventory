## Why

Halaman dashboard saat ini hanya mengandalkan variasi Bar Chart (`FunnelChart`, `TierStockBar`, `CoverageChart`) dan Donut Chart (`ConditionDonut`, `PaymentsDonut`). Pengguna menyampaikan masukan bahwa visualisasi data terlalu monoton dan kurang beragam untuk merepresentasikan alur logistik, kesehatan inventaris, dan komposisi stok buku multi-cabang. Diperlukan variasi chart types baru yang lebih intuitif, dinamis, dan representatif tanpa mengubah kontrak data backend.

## What Changes

- **Pipeline Flow (Alur Pemenuhan)**: Menggantikan bar chart 3 tiang pada `FunnelChart` dengan representasi Stepped Pipeline / Process Flow cards yang menunjukkan aliran tahap pesanan (*Menunggu* -> *Siap Diambil* -> *Sudah Diambil*) beserta throughput dan drop-off secara jelas.
- **Semi-Circle Gauge / Radial Progress (Cakupan & Pembayaran)**:
  - Menyediakan visualisasi Radial Gauge / Progress Meter untuk rasio pemenuhan paket (`Coverage`), menggantikan bar vertikal polos dengan meteran target/threshold (Kritis <70%, Waspada 70-89%, Aman >=90%).
  - Mengubah indikator pelunasan pembayaran menjadi radial meter / linear progress ringkas agar tidak bertumpuk membosankan dengan donut kondisi fisik.
- **Stock Treemap (Peta Komposisi Stok Buku)**: Menambahkan komponen visual Treemap (`StockTreemap`) menggunakan `<Treemap>` bawaan `recharts` untuk memvisualisasikan proporsi judul buku teratas (`stock.byTitle`) berdasarkan volume stok di gudang/cabang.
- **Integrasi & Tata Letak Dashboard**: Mengintegrasikan komponen chart baru ke dalam `DashboardView` dengan tata letak yang proporsional, rapi, dan mematuhi batas ukuran file (<400 baris) serta estetika B2B logistics.

## Capabilities

### New Capabilities
- `dashboard-visualization-variety`: Kemampuan visualisasi analitik dashboard dengan variasi tipe chart modern (Stepped Pipeline, Radial Gauge Meter, dan Treemap Sebaran Stok).

### Modified Capabilities
<!-- None -->

## Impact

- **Frontend Components**:
  - `src/components/dashboard/FunnelChart.tsx` (diperbarui menjadi pipeline flow / stepped chart)
  - `src/components/dashboard/StockTreemap.tsx` (komponen baru berbasis Recharts Treemap)
  - `src/components/dashboard/CoverageGauge.tsx` atau `src/components/dashboard/CoverageChart.tsx` (penambahan visual gauge / radial progress)
  - `src/components/dashboard/PaymentsDonut.tsx` / `PaymentsMeter.tsx` (penyegaran meter pembayaran)
  - `src/views/DashboardView.tsx` (penataan ulang grid layout chart)
- **APIs & Database**: Tidak ada perubahan skema database maupun endpoint API backend; seluruh chart baru memanfaatkan data yang sudah disediakan oleh endpoint `/api/dashboard/summary`.
- **Dependencies**: Menggunakan library yang sudah ada (`recharts`, `lucide-react`, `tailwindcss`).
