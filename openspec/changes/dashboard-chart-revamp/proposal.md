## Why

Halaman dashboard saat ini hanya mengandalkan variasi Bar Chart dan Donut Chart baik di level detail sekolah maupun halaman utama Admin Pusat (Mode Komparasi). Pengguna menyampaikan masukan bahwa visualisasi data terlalu monoton dan kurang beragam. Diperlukan variasi chart types baru yang kaya dan representatif untuk kedua level dashboard:
1. **Dashboard Persekolah**: Stepped Pipeline Flow, Radial Speedometer Gauge, dan Treemap Sebaran Stok Judul.
2. **Dashboard Admin Pusat (Semua Sekolah)**: Scatter/Bubble Plot Matriks Kesehatan Cabang (Stok vs Pembayaran), Horizontal Ranking Bar Kesiapan Sekolah, dan Stepped Pipeline Gabungan.

## What Changes

- **Admin Pusat - Branch Health Matrix (Scatter/Bubble Plot)**: Menambahkan komponen `BranchHealthScatter` menggunakan `<ScatterChart>` Recharts untuk memetakan seluruh cabang sekolah ke dalam 4 kuadran risiko (Sumbu X: % Kesiapan Stok Paket, Sumbu Y: % Pembayaran Lunas, Ukuran Bubble: Total Pesanan).
- **Admin Pusat - Horizontal Performance Ranking Bar**: Menggantikan bar chart tiang vertikal `CoverageChart` dengan horizontal ranking bars berlabel jelas dan kode warna ambang batas (Kritis/Waspada/Aman).
- **Admin Pusat - Stepped Pipeline Agregat**: Merombak tampilan satu bar tipis pada `ComparisonOverview` menjadi Stepped Pipeline Cards agregat lintas cabang sekolah.
- **Persekolah**: Mempertahankan dan menyempurnakan `FunnelChart` (Stepped Pipeline), `CoverageGauge` (Radial Gauge), `StockTreemap` (Treemap 12 judul buku), dan `PaymentsMeter`.
- **Integrasi**: Menata ulang `DashboardView.tsx` dan `ComparisonOverview.tsx` agar visual dashboard di level pusat maupun cabang terasa beragam, dinamis, dan editorial.

## Capabilities

### New Capabilities
- `dashboard-visualization-variety`: Kemampuan visualisasi analitik dashboard dengan variasi tipe chart modern untuk level persekolah maupun Admin Pusat (Stepped Pipeline, Radial Gauge Meter, Treemap Sebaran Stok, dan Scatter Matrix Kuadran Cabang).

### Modified Capabilities
<!-- None -->

## Impact

- **Frontend Components**:
  - `src/components/dashboard/BranchHealthScatter.tsx` (komponen baru berbasis Recharts ScatterChart)
  - `src/components/dashboard/CoverageChart.tsx` (diubah menjadi horizontal ranking bar yang informatif)
  - `src/components/dashboard/ComparisonOverview.tsx` (direfaktor dengan stepped pipeline agregat & meter pembayaran terpadu)
  - `src/views/DashboardView.tsx` (integrasi layout Admin Pusat & Detail Sekolah)
- **APIs & Database**: Tidak ada perubahan skema database maupun endpoint API backend; seluruh data dihitung dari payload `/api/dashboard/summary`.
