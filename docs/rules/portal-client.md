# Aturan Portal Publik & UI Klien

Dokumen ini memuat aturan kanonik dan mandat anti-kambuh untuk pengembangan portal publik siswa/wali dan komponen antarmuka klien staf.

---

## Mandat Anti-Kambuh

### §0.1. Kontrak Path API
Setiap literal `/api/...` di klien wajib menunjuk route yang terdaftar, dan portal publik hanya boleh memanggil `/api/public/*`. Ditegakkan mekanis oleh `bun run check:api-contract` (pre-commit, CI, `check:all`). Menambah endpoint berarti: daftarkan di router, lalu pakai path itu dari klien.

### §0.2. Navigasi Data-Driven
Daftar tab/nav wajib berupa array data (`PUBLIC_TABS`, `DESKTOP_TABS`), bukan JSX inline. Tab baru = entry array + test yang mengunci daftar (`PortalTabs.test.tsx`, `staff-tabs.test.ts`). JSX inline membuat tab rusak/hilang lolos `type-check`, `lint`, dan `build`.

### §0.3. Pintu Masuk Teruji
Sebelum lapor selesai, buktikan jalur yang membuka UI itu ada (tab, tautan, atau URL→tab mapping di `src/lib/public-portal-url.ts`) dan memiliki test. Komponen yang tidak bisa dicapai dari UI = fitur belum jadi, walau semua gate hijau.

### §0.6. Pasangan Tab Staf & Renderer
`TAB_IDS` + `STAFF_TAB_RENDERERS` wajib berpasangan; `Record<ActiveTab, …>` membuat tab tanpa renderer gagal `type-check`.

### §0.8. State Draf Portal
State + transisi draf order wajib berada di `useOrderDraft`; step menerima `{ draft, actions }`, bukan belasan pasangan nilai/setter. Server tetap otoritas validasi terakhir.

### §0.12. Anti Parameter Inversion pada API Client
Endpoint klien dengan 2+ parameter primitif (terutama kombinasi string `query` dan `schoolId`) wajib menerima objek parameter terstruktur (misal `{ query, schoolId }`). Setiap custom hook data-fetching portal wajib memiliki unit regression test (`use*.test.ts`) yang memverifikasi query string URL terkirim dengan parameter yang tepat.

### §0.14. Intake Seam Portal Tunggal
Seluruh alur pencarian dan identifikasi murid portal (buku, seragam, dsb.) wajib memakai modul hook intake kanonik `useStudentSearch` (`src/components/portal/useStudentSearch.ts`), dilarang membuat state search/debouncing inline di view atau menduplikasi modal murid baru.

### §0.45. Integritas Alur Sign Out & Transisi Otentikasi Sesi
Proses sign out staf wajib mengarahkan pengguna kembali ke halaman login staf (`/login` / `LoginView`), bukan dibiarkan menggantung atau terlempar ke portal publik:
1. Tombol sign out di komponen layout (`AppHeader.tsx`) wajib memiliki state proteksi `isSigningOut` / `disabled` guna mencegah re-entry atau klik ganda saat request jaringan berlangsung.
2. Handler sign out (`handleSignOut`) dilarang menduplikasi mutasi state navigasi (`setShowStaffLogin`, `setIsPublicMode`, `pushState`) di kedua blok `onSuccess` dan `finally`; tempatkan transisi penataan state secara bersih pada blok penyelesaian (`finally`) agar selalu tereksekusi tepat satu kali baik saat response sign-out berhasil maupun saat terjadi kegagalan jaringan (resilient offline fallback).

### §0.46. Disiplin Universal No-Silent-Catch & Penanganan Error UI
Seluruh pemanggilan data fetching asinkron (`fetch`, `getJson`, dsb.) di komponen antarmuka staf maupun portal publik (`src/components/**`, `src/views/**`) dilarang menggunakan *silent-catch* (`.catch(() => {})`, `.catch(() => undefined)`), karena menutupi kegagalan backend dan membuat status tampilan menjadi zombie/stale:
1. Setiap kegagalan wajib ditangkap ke state error lokal/toast yang ramah pengguna agar kesalahan sistem selalu tampak.
2. Ditegakkan mekanis di pre-commit dan CI oleh gate `check:no-silent-catch` yang memindai seluruh direktori UI komponen.

### §0.47. Kanonikalisasi Sub-Navigasi Segmented & Reaktivitas Sub-Seksi View
View yang memiliki sub-seksi bertingkat (seperti Seragam dan Gudang Buku):
1. Wajib menggunakan komponen sub-navigasi kanonik bersama `SegmentedSubNav` (`src/components/ui/SegmentedSubNav.tsx`), dilarang menduplikasi styling navigasi pil/segmented inline.
2. State sub-seksi internal (`activeSection`) yang menerima prop `defaultSection` dari luar (dashboard link/delegated route) wajib menyinkronkan perubahan via `useEffect(() => { setActiveSection(defaultSection); }, [defaultSection])` guna mencegah bug desync navigasi saat view induk tetap berstatus terpasang (*mounted*).

### §0.48. Disiplin Konsumsi Helper Intake & Anti-Tautologi Predikat UI
1. Seluruh fungsi helper domain/filter yang dibuat di bawah `src/lib/` (seperti `filterBranchSchools`) wajib dikonsumsi secara aktif oleh pemanggil fitur di view/komponen terkait dalam diff yang sama; dilarang meninggalkan helper hanya terhubung ke file unit test-nya sendiri (*speculative generality / dead code*).
2. Pada percabangan rendering form/modal intake (seperti pemilih cabang di `StudentBulkUploadModal`), predikat kondisi wajib diekspresikan secara ketat (`(!initialSchoolId || initialSchoolId === "all") && schools.length > 0`), dilarang memasang disjungsi longgar (`|| schools.length > 0`) yang membuat percabangan bersifat tautologis.
