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

### §0.63. Form Validation Feedback Loop & Tombol Submit Interaktif
1. Dilarang menonaktifkan tombol submit secara pasif (`disabled={isMissingField}`) saat formulir belum terisi lengkap yang membingungkan pengguna (mengira form/sistem hang). Tombol submit wajib tetap responsif untuk divalidasi saat diklik. Pengecualian: `disabled` diizinkan untuk mencegah double submission (`isSubmitting`) atau kontrak otomasi demo yang secara eksplisit menguji kecocokan kode unik (`OrderHandoverModal` §0.43).
2. Setiap kegagalan validasi wajib menampilkan garis batas peringatan merah (`border-rose-500`), teks bantuan spesifik di bawah input (`FormFieldFeedback`), banner ringkasan kesalahan di atas tombol submit (`FormSummaryAlert`), dan memfokuskan kursor secara otomatis ke elemen pertama yang tidak valid.
3. Seluruh aturan alokasi pembayaran form kasir/portal wajib memanggil single-writer kanonik `allocationViolation` (`src/lib/order-allocation.ts`), dilarang membuat aturan alokasi lokal mandiri.
4. Pada form mutasi/entri master (seperti varian katalog, form penyesuaian stok, atau form reject), draft input wajib dikoordinasikan dalam model state terpadu (anti-data-clump), filter pencarian didelegasikan ke predikat domain, dan tombol aksi dilarang terkunci tanpa penjelasan klik.
5. Aksi formulir lanjutan berbasis baris data (seperti input ongkir, resi ekspedisi, atau bayar kasir manual) yang dipicu dari baris tabel/kartu wajib menggunakan modal pop-up kontekstual yang membawa identitas entitas (nomor order & nama murid), dilarang merender inline-form melayang di atas halaman yang memutus konteks data pengguna.

### §0.67. Unifikasi Adapter Klien Publik & Larangan Overload Usang
1. Seluruh adapter fetch klien portal publik (buku dan seragam) wajib terkonsentrasi di `src/components/portal/portal-api.ts`. File `uniform-portal-api.ts` hanya bertindak sebagai wrapper re-export tipis untuk backward-compatibility tanpa logika fetch duplikat.
2. Adapter klien terpadu dilarang membawa kembali parameter overload usang (seperti `paramsOrQuery: ... | string, legacySchoolId?: string`). Seluruh pemanggil pencarian wajib menggunakan objek parameter terstruktur (`StudentSearchParams`, §0.12).
3. Endpoint publik untuk daftar sekolah adalah `/api/public/orders/schools`. Dilarang mengarahkan portal publik ke endpoint staf `/api/schools` (§0.1).

### §0.68. Penyesuaian Mandiri Kurikulum Portal & Parameter Endpoint Terproteksi
1. Pembaruan mandiri kurikulum/peminatan murid dari portal publik (`/api/public/orders/students/:id/curriculum`) wajib memvalidasi parameter route identifier menggunakan `idSchema` (`zValidator("param", z.object({ id: idSchema }))`), dilarang membaca parameter mentah tanpa skema.
2. Pilihan kurikulum pada antarmuka publik dan validasi server wajib difilter secara ketat berdasarkan jenjang tingkat kelas murid (`getAvailableCurriculaForGrade`), dilarang menampilkan pilihan kurikulum yang tidak relevan dengan jenjang anak.
3. Test suite baru untuk fitur pembaruan portal wajib membersihkan seluruh fixtures data dummy/seeder (`schools`, `students`, `bookPackages`, `studentBookOrders`) pada blok penyelesaian tes (`cleanup`/`finally`) guna menjamin isolasi database pengujian (§6.1).
4. State mutation array murid di view portal wajib dibungkus dalam action hook (`updateSearchResult`), dilarang mengekspos raw array setter (`setSearchResults`) langsung ke komponen antarmuka.

### §0.69. Single-Writer Ekspor CSV & Dekomposisi Shell Drawer Dashboard
1. Seluruh pengunduhan file CSV di antarmuka web klien wajib menggunakan fungsi kanonik tunggal `exportCsvFile` (`src/lib/csv-export.ts`), dilarang merakit inline Blob dan manipulasi elemen `<a>` manual di setiap komponen view/drawer.
2. Drawer drill-down dashboard eksekutif dan view multi-cabang wajib menggunakan shell layout bersama `ExecutiveBreakdownDrawerShell` (`src/components/dashboard/ExecutiveBreakdownDrawerShell.tsx`) guna menjamin konsistensi header, padding, escape modal, dan tombol aksi tanpa duplikasi kode.
3. Tipe data dashboard eksekutif dikelola secara terpusat di `src/lib/dashboard-types.ts`; service backend wajib mengimpor langsung tipe tersebut tanpa deklarasi duplikat di `*-types.ts` lokal.
4. Agregasi piutang (*outstanding debt*) dashboard wajib memanggil predikat kanonik `isOpenOrder(order.paymentStatus)` sebelum menjumlahkan `outstandingOf(order)`, guna mengecualikan pesanan batal atau pesanan yang telah lunas/non-aktif.

