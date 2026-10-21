# Design

## Context

Lihat `proposal.md` untuk motivasi dan latar belakang masalah.
Saat ini state `activeTab` di [App.tsx](file:///D:/development/book-inventory/src/App.tsx) di-hardcode ke `"dashboard"` saat pertama kali render. Komponen [AppTabsNavigation.tsx](file:///D:/development/book-inventory/src/components/layout/AppTabsNavigation.tsx) menentukan tab desktop mana yang visible lewat fungsi predikat `visible(role)`, namun:
1. Tidak ada helper kanonik untuk menentukan tab awal (`defaultTab`) per role saat user login.
2. Tidak ada reactive guard di `App.tsx` yang memverifikasi apakah `activeTab` saat ini diizinkan untuk `userRole`.
3. Komponen [AppMobileNavigation.tsx](file:///D:/development/book-inventory/src/components/layout/AppTabsNavigation.tsx#L172) merender daftar tab mobile secara statis tanpa memanggil predikat `visible(role)`.
4. Komponen [AppHeader.tsx](file:///D:/development/book-inventory/src/components/layout/AppHeader.tsx) hanya membedakan `isCentralAdmin` vs `"Branch Admin"`.

## Goals / Non-Goals

**Goals:**
- Menyediakan helper kanonik di `src/lib/staff-roles.ts` untuk:
  - `getVisibleTabsForRole(role: StaffRole): ActiveTab[]`
  - `getDefaultTabForRole(role: StaffRole): ActiveTab`
  - `getRoleBadgeLabel(role: StaffRole): string`
- Menghubungkan helper ini ke `App.tsx` sehingga pengguna langsung mendarat di tab yang sah saat login dan tab tidak sah di-redirect ke `defaultTab`.
- Menyaring menu navigasi mobile (`AppMobileNavigation`) menggunakan `visible(role)` yang sama dengan desktop.
- Memperbaiki label profil di `AppHeader.tsx`.

**Non-Goals:**
- Mengubah skema database atau tabel `users`.
- Mengubah logika bisnis atau mutasi API backend (backend sudah memiliki middleware guard terpisah di `access-scope.ts`).

## Decisions

### 1. Definisi Default Tab per Role
- `central_admin` -> `"dashboard"`
- `warehouse_admin` -> `"dashboard"`
- `warehouse_books_admin` -> `"internal_orders"` (Pesanan dari Cabang)
- `warehouse_uniforms_admin` -> `"uniforms"` (Gudang Seragam)
- `school_admin` / `branch_admin` -> `"internal_orders"` (Pesan ke Gudang)

*Alternatif*: Selalu memakai tab pertama dari `visibleTabs`. Keputusan: Fungsi `getDefaultTabForRole` secara eksplisit mendefinisikan prioritas tab terbaik untuk landing page tiap role agar UX lebih terarah.

### 2. Auto-Redirect Guard di `App.tsx`
Menambahkan `useEffect` di `App.tsx` yang memantau `[session, activeTab]`:
Jika `sessionRole` ada dan `activeTab` tidak termasuk dalam `getVisibleTabsForRole(sessionRole)`, panggil `setActiveTab(getDefaultTabForRole(sessionRole))`.

### 3. Koreksi Visibilitas Tab Gudang Umum (`warehouse_admin`)
Peran `warehouse_admin` adalah Admin Gudang Umum (Buku & Seragam). Di `AppTabsNavigation.tsx`, predikat tab buku (`student_orders`, `packages`, `procurement`, `returns`, `inventory`, `catalog`, `reconciliation`, `reports`) diselaraskan agar mengizinkan `isBookWarehouseStaffRole(r)` yang memang sudah menyertakan `warehouse_admin` di `staff-roles.ts`.

### 4. Label Header Staf yang Komprehensif
Di `AppHeader.tsx`:
- `central_admin`: "HQ Central Admin"
- `warehouse_uniforms_admin`: "Admin Gudang Seragam"
- `warehouse_books_admin`: "Admin Gudang Buku"
- `warehouse_admin`: "Admin Gudang"
- `school_admin` / `branch_admin`: "Branch Admin"

## Risks / Trade-offs

- [User me-refresh browser saat berada di tab tertentu] -> Jika tab tersebut diizinkan untuk rolenya, state tetap aman. Jika tab tersebut tidak diizinkan, guard akan mengembalikannya ke tab default tanpa crash.
- [Batas file 400 baris (AGENTS.md)] -> Helper diletakkan di `src/lib/staff-roles.ts` (saat ini hanya 29 baris) agar modul layout tetap ramping.
