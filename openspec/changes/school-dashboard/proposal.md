## Why

Staf logistik (HQ maupun cabang) saat ini harus membuka 7 tab terpisah (pesanan, paket, PO, retur, stok, katalog, transfer) hanya untuk menjawab pertanyaan paling dasar: "sekolah ini siap layani siswa atau tidak?". Permintaan user: satu dashboard ringkasan buku per sekolah yang informatif dan cantik sebagai halaman pertama setelah login.

## What Changes

- Tab/layar baru **Dashboard** yang menjadi tampilan default setelah staf login (menggantikan default `student_orders` di `App.tsx`).
- Dua mode dalam satu layar: **perbandingan 4 kampus** untuk `central_admin`, **detail 1 kampus** untuk `branch_admin` (menghormati isolasi cabang yang sudah ada).
- Satu endpoint agregat baru `GET /api/dashboard/summary?schoolId=` yang menghitung seluruh metrik dalam satu round-trip.
- Hero metric: **coverage ratio** (`paket ready / pesanan waiting_preparation`), didampingi **fulfillment funnel** (`waiting -> ready_for_pickup -> picked_up`) sebagai diagnosa.
- 3 chart Recharts (bar coverage per sekolah, bar funnel, donut kondisi buku); KPI dan daftar perhatian tetap Tailwind murni.
- Dependensi baru: `recharts` (di-lazy-load agar portal publik tidak ikut mengunduhnya).

## Capabilities

### New Capabilities
- `school-dashboard`: Ringkasan operasional buku per sekolah — metrik coverage, funnel pemenuhan, kesehatan pembayaran, daftar perhatian operasional, dan breakdown per jenjang/kurikulum; termasuk kontrol akses per peran (HQ vs cabang) dan perilaku endpoint agregat.

### Modified Capabilities
- (tidak ada — tidak ada perubahan perilaku pada capability yang sudah berjalan; default tab awal di `App.tsx` adalah perubahan navigasi dalam cakupan capability baru ini)

## Impact

- Frontend: `src/App.tsx` (default tab + tab Dashboard), file baru di `src/views/DashboardView.tsx`, `src/components/dashboard/*`, `src/server/routes/dashboard.ts`, `src/server/services/dashboard-summary.ts`.
- Dependensi: `recharts` ditambahkan ke `package.json` (lazy import via `React.lazy`).
- Backend: endpoint read-only baru; tidak ada perubahan schema database (seluruh metrik dihitung dari tabel yang sudah ada).
- Tidak ada breaking change pada API maupun alur yang sudah berjalan.
