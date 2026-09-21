## Context

Sistem inventaris buku ini berjalan di atas Hono (backend) + Drizzle ORM (SQLite) + React/Vite (frontend). Sebelumnya, autentikasi dan RBAC belum diimplementasikan di tingkat runtime (hanya ada tabel draft `users` di Drizzle), frontend hanya menggunakan switcher cabang lokal, belum ada UI untuk mengelola data sekolah maupun user, dan data demo masih berupa 2 sekolah kosong.

## Goals / Non-Goals

**Goals:**
- Mengintegrasikan `better-auth` dengan Hono dan Drizzle ORM untuk manajemen sesi login berbasis cookie/bearer token.
- Menyediakan tabel user terintegrasi dengan field `role` (`central_admin` vs `branch_admin`) dan `schoolId`.
- Membuat UI Settings yang mencakup:
  1. Manajemen Sekolah (Tambah/Edit Sekolah HQ & Cabang).
  2. Manajemen Pengguna (Tambah/Edit Pengguna, Penetapan Peran, dan Penugasan Cabang).
- Membuat Halaman Login modern minimalis dengan kartu Quick-Demo Login (Central Admin Al Wildan 1, Branch Admin Al Wildan 2, dsb.).
- Membuat script/endpoint seeding demo data Al Wildan (4 sekolah) dan buku kurikulum Cambridge beserta ratusan eksemplar fisik ber-barcode.
- Menegakkan branch isolation di frontend dan backend sesuai peran pengguna aktif.

**Non-Goals:**
- Integrasi OAuth eksternal pihak ketiga (Google/GitHub login) saat ini, cukup email/password & quick credentials.
- Multi-tenancy lintas yayasan (arsitektur difokuskan untuk 1 yayasan/organisasi sekolah dengan cabang-cabang di bawahnya).

## Decisions

### 1. Better-Auth Architecture
- **Pilihan**: Menggunakan `better-auth` dengan adapter Drizzle / SQLite.
- **Rasional**: `better-auth` adalah library auth TypeScript modern yang sangat ringan, type-safe, dan kompatibel langsung dengan Hono dan Drizzle ORM tanpa ketergantungan framework Next.js.
- **Alternatif yang Dipertimbangkan**: Custom JWT manual (lebih rentan celah keamanan dan memerlukan pengelolaan token refresh manual) atau Auth0/Clerk (terikat vendor SaaS eksternal berbayar).

### 2. User & School Management UI (Settings View)
- **Pilihan**: Menambahkan tab `Settings` di navigasi utama untuk pengguna dengan peran `central_admin`, yang berisi sub-tab "School Hierarchy" dan "User Accounts".
- **Rasional**: Memisahkan operasional logistik harian (Katalog, Inventaris, Transfer) dengan konfigurasi tata kelola administratif.

### 3. Demo Seeding Strategy
- **Pilihan**: Menyediakan endpoint `POST /api/demo/seed` dan tombol "Reset / Load Al Wildan Demo" yang dapat dipicu sekali klik.
- **Rasional**: Memudahkan demonstrasi dan pengujian alur transfer multi-cabang tanpa mengharuskan pengguna mengetik data satu per satu dari nol.

## Risks / Trade-offs

- [Integrasi tabel Better-Auth dengan skema lama `users`] → Buat skema tabel auth standar `user`, `session`, `account`, `verification` yang selaras dengan Drizzle dan field kustom `role` & `schoolId`.
- [Branch Admin mencoba mengakses cabang lain via URL/API] → Pasang middleware otorisasi di Hono router untuk memverifikasi kesesuaian `schoolId` dengan parameter yang diminta.
