## Context

Frontend dashboard memiliki dua mode: Detail Sekolah (untuk admin cabang atau drill-down) dan Komparasi Semua Sekolah (untuk Admin Pusat). Keduanya menggunakan `recharts` dan Tailwind CSS. Komponen terbagi rapi di bawah `src/components/dashboard/` dan dirangkum oleh `src/views/DashboardView.tsx`.

## Goals / Non-Goals

**Goals:**
- Merombak visual dashboard di kedua level (Admin Pusat & Persekolah) agar tidak ada lagi dominasi monoton bar vertikal dan pie bertumpuk:
  1. **Admin Pusat**:
     - `BranchHealthScatter.tsx`: Scatter/Bubble Matrix (Sumbu X = % Coverage, Sumbu Y = % Payment, Z = Volume Pesanan).
     - `CoverageChart.tsx`: Horizontal Ranked Bar (nama sekolah jelas di kiri, bar memanjang horizontal dengan tone warna status).
     - `ComparisonOverview.tsx`: Stepped Pipeline Agregat (3 tahap pemenuhan nasional).
  2. **Persekolah**:
     - `FunnelChart.tsx` (Stepped Pipeline), `CoverageGauge.tsx` (Radial Speedometer), `StockTreemap.tsx` (Treemap 12 judul), `PaymentsMeter.tsx` (Segmented meter).
- Menjaga setiap file <= 400 baris, zero TypeScript errors, responsif di mobile.

**Non-Goals:**
- Mengubah skema database Drizzle atau backend endpoints.

## Decisions

### Decision 1: Branch Health Matrix Menggunakan Recharts `<ScatterChart>`
- **Pilihan**: `<ScatterChart>` dengan `<XAxis dataKey="coverage">`, `<YAxis dataKey="payment">`, `<ZAxis dataKey="orders" range={[60, 400]}>`, dan reference lines pada titik 70% X dan 70% Y untuk membagi 4 kuadran.
- **Alasan**: Memberikan kemampuan diagnosis instan bagi Admin Pusat untuk mengidentifikasi cabang yang tertinggal dalam inventaris maupun pelunasan keuangan.

### Decision 2: Horizontal Ranked Bars untuk Kesiapan Cabang
- **Pilihan**: Layout vertikal pada `<BarChart layout="vertical">` yang otomatis mengurutkan sekolah dari cakupan terendah ke tertinggi.
- **Alasan**: Lebih mudah dibaca daripada bar chart kolom vertikal yang label namanya sering miring atau terpotong.

## Risks / Trade-offs

- **[Risk]** Titik pada Scatter Chart bisa saling bertumpuk jika dua sekolah memiliki % coverage dan payment yang persis sama.
  - *Mitigasi*: Gunakan opacity fill (`fillOpacity={0.75}`) dan tooltip kaya informasi yang menampilkan nama sekolah dan detail volume.
