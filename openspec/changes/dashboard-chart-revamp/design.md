## Context

Frontend dashboard saat ini menggunakan library `recharts` 2.x dengan styling Tailwind CSS. Komponen dashboard berada di `src/components/dashboard/` dan dirangkai oleh `src/views/DashboardView.tsx`. Endpoint backend `/api/dashboard/summary` sudah menyediakan seluruh payload yang dibutuhkan, termasuk data detail judul buku (`summary.stock.byTitle`), status funnel (`summary.funnel`), dan breakdown jenjang (`summary.breakdown`).

## Goals / Non-Goals

**Goals:**
- Menggantikan tampilan monoton Bar & Pie dengan tipe visual yang bervariasi:
  1. Stepped Pipeline Flow untuk alur pesanan (`FunnelChart`).
  2. Radial Gauge / Half-donut Meter untuk rasio pemenuhan paket (`CoverageGauge`).
  3. Treemap interaktif untuk sebaran stok judul buku (`StockTreemap`).
  4. Radial / Compact meter untuk pembayaran (`PaymentsMeter`).
- Menjaga kepatuhan aturan codebase: setiap file baru/modifikasi <= 400 baris, zero TypeScript errors, responsif di mobile & desktop.
- Menggunakan library `recharts` dan SVG/Tailwind yang sudah ada tanpa menambah third-party dependency baru.

**Non-Goals:**
- Mengubah skema database Drizzle atau menambah kolom baru.
- Mengubah endpoint API backend (`/api/dashboard/summary`).
- Menambahkan chart grafik time-series kompleks yang membutuhkan histori harian/bulanan di database yang belum tersedia.

## Decisions

### Decision 1: Funnel Menggunakan Stepped Pipeline Component
- **Pilihan**: Komponen custom berbasis flexbox/grid Tailwind dengan connecting chevron arrows, progress percentage, dan badge status warna.
- **Alternatif yang ditolak**: Bar chart 3 kolom standar (terlalu membosankan dan tidak mencerminkan flow perpindahan fisik) atau library funnel eksternal (menambah bundle size).
- **Alasan**: Lebih representatif untuk alur fisik pergudangan buku (Menunggu -> Siap -> Diambil).

### Decision 2: Coverage Menggunakan Semi-Circle Radial Gauge
- **Pilihan**: `recharts` `<PieChart startAngle={180} endAngle={0}>` dengan 2 layer: track background netral (`#E4E6EB`) dan arc progres dinamis bertema warna status (Merah `#EF4444`, Kuning `#F59E0B`, Hijau `#10B981`), dengan teks metrik di tengah busur.
- **Alternatif yang ditolak**: RadialBarChart standar (sering memiliki bug sizing label di container kecil) atau SVG path statis.
- **Alasan**: Kompatibel penuh dengan Recharts ResponsiveContainer dan konsisten dengan sistem tema antarmuka.

### Decision 3: Stock Treemap Menggunakan Recharts `<Treemap>`
- **Pilihan**: Recharts `<Treemap>` dengan custom content renderer untuk menangani penyesuaian teks judul buku, kuantitas stok, dan warna tile bergradasi sesuai volume.
- **Alternatif yang ditolak**: D3 manual wrapper (terlalu verbose dan risiko memori leak).
- **Alasan**: Sangat efektif memanfaatkan ruang 2D untuk membandingkan 6-12 judul buku dengan stok terbanyak di sekolah.

### Decision 4: Pemisahan Modul & Batas Ukuran File (<400 Baris)
- Setiap chart type dibuat sebagai komponen terisolasi di `src/components/dashboard/`:
  - `FunnelChart.tsx` (revamped)
  - `CoverageGauge.tsx` (baru)
  - `StockTreemap.tsx` (baru)
  - `PaymentsMeter.tsx` (baru/pengganti Donut yang repetitif)
- `DashboardView.tsx` hanya bertindak sebagai layout orchestrator.

## Risks / Trade-offs

- **[Risk]** Judul buku pada tile Treemap yang berukuran kecil bisa terpotong atau overflow text.
  - *Mitigasi*: Custom node content merender truncate ellipsis dan memanfaatkan tooltip interaktif saat hover/tap pada mobile.
- **[Risk]** Sekolah dengan nol stok atau nol pesanan bisa merender chart kosong yang aneh.
  - *Mitigasi*: Setiap komponen chart wajib menyertakan pengecekan empty state terpadu dengan pesan ramah pengguna.
