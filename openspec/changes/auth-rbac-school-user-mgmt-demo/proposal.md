## Why

Saat ini aplikasi belum memiliki antarmuka (UI) untuk manajemen sekolah dan manajemen pengguna (user management), autentikasi masih bersifat mockup switcher tanpa proteksi RBAC nyata dengan session, dan data inventaris masih kosong (hanya 2 sekolah dummy awal). Diperlukan integrasi autentikasi modern berbasis `better-auth`, pengaturan hierarki sekolah (HQ & branch), manajemen pengguna dengan pembagian peran (`central_admin` vs `branch_admin`), serta demo dataset nyata 4 sekolah Al Wildan (Pusat & Cabang 2, 3, 4) lengkap dengan katalog buku kurikulum Cambridge dan riwayat pergerakan logistik.

## What Changes

- **School & Branch Settings Management**: Menambahkan UI Settings/Management untuk melihat, menambah, dan mengedit data sekolah (memastikan aturan tepat 1 HQ dan n cabang).
- **User Management & RBAC**: Menyediakan antarmuka pengelolaan pengguna (Admin Pusat & Admin Cabang) dengan penugasan sekolah (`schoolId`) dan hak akses yang terisolasi.
- **Better-Auth Integration**: Mengintegrasikan engine autentikasi `better-auth` dengan backend Hono dan database SQLite Drizzle, menyediakan endpoint login, session handling, dan perlindungan route/middleware.
- **Login Screen with Demo Switcher**: Halaman login modern bernuansa editorial/minimalis dengan tombol akses cepat satu-klik untuk akun demo (Central Admin Al Wildan 1 Pusat, Branch Admin Al Wildan 2, dsb.).
- **Al Wildan & Cambridge Demo Data Seeding**: Endpoint/script seeding otomatis untuk 4 kampus Al Wildan, buku kurikulum Cambridge (English, Math, Science, IGCSE) beserta puluhan unit eksemplar fisik ber-barcode unik dan draft/in-transit transfer antarsekolah.

## Capabilities

### New Capabilities
- `auth-and-rbac`: Autentikasi berbasis `better-auth`, manajemen sesi login, proteksi endpoint, dan pembatasan wewenang Central Admin vs Branch Admin.
- `user-management`: Antarmuka dan API untuk membuat, mengedit, dan mengelola akun pengguna serta penugasan cabang sekolahnya.
- `demo-seed-cambridge`: Penyediaan dataset demo realistis 4 sekolah Al Wildan dan katalog buku kurikulum Cambridge dengan unit inventaris dan mutasi transfer antar sekolah.

### Modified Capabilities
- `school-management`: Penambahan antarmuka frontend (Settings UI) untuk mengelola data sekolah secara dinamis di samping API yang sudah ada.

## Impact

- **Backend**: Integrasi paket `better-auth`, middleware verifikasi session/role di Hono, penambahan route `/api/users`, pembaruan route `/api/schools`, dan endpoint seed `/api/demo/seed`.
- **Database**: Skema tabel auth (`user`, `session`, `account`, `verification`) dan relasi user ke `schools`.
- **Frontend**: Halaman Login (`/login`), View Settings (School & User Management), komponen header status login & logout, serta pembaruan tampilan navigasi sesuai peran aktif pengguna.
