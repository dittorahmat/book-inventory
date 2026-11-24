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
4. Pada form mutasi/entri master (seperti varian katalog, form penyesuaian stok, form reject, atau modal pembuatan Purchase Order baru), draft input wajib dikoordinasikan dalam model state terpadu (anti-data-clump), filter pencarian didelegasikan ke predikat domain, dan tombol aksi dilarang terkunci tanpa penjelasan klik. Form PO/mutasi wajib mengonsumsi `FormFieldFeedback` dan `FormSummaryAlert` alih-alih banner error custom ad-hoc.
5. Aksi formulir lanjutan berbasis baris data (seperti input ongkir, resi ekspedisi, atau bayar kasir manual) yang dipicu dari baris tabel/kartu wajib menggunakan modal pop-up kontekstual yang membawa identitas entitas (nomor order & nama murid), dilarang merender inline-form melayang di atas halaman yang memutus konteks data pengguna.
6. **Dual Layout & Table Discipline**: Modul daftar/katalog master dengan data banyak wajib mengimplementasikan struktur ganda (tabel berkolom terstruktur desktop `hidden md:block` dan kartu mobile `md:hidden`), dilengkapi toolbar pencarian instan (search). Pada tabel laporan, baris data wajib menggunakan elemen semantik `<table>` ber-header jelas, dilarang merender list `div` bertumpuk tanpa kolom teratur.
7. **Styling Tokens Konsisten**: Nilai kelas input (`UNIFORM_INPUT_CLS`) dan label (`UNIFORM_LABEL_CLS`) wajib menggunakan token bersama, dilarang menduplikasi string kelas Tailwind lokal di banyak file komponen tetangga.

### §0.67. Unifikasi Adapter Klien Publik & Larangan Overload Usang
1. Seluruh adapter fetch klien portal publik (buku dan seragam) wajib terkonsentrasi di `src/components/portal/portal-api.ts`. File `uniform-portal-api.ts` hanya bertindak sebagai wrapper re-export tipis untuk backward-compatibility tanpa logika fetch duplikat.
2. Adapter klien terpadu dilarang membawa kembali parameter overload usang (seperti `paramsOrQuery: ... | string, legacySchoolId?: string`). Seluruh pemanggil pencarian wajib menggunakan objek parameter terstruktur (`StudentSearchParams`, §0.12).
3. Endpoint publik untuk daftar sekolah adalah `/api/public/orders/schools`. Dilarang mengarahkan portal publik ke endpoint staf `/api/schools` (§0.1).

### §0.68. Penyesuaian Program Belajar Portal & Sinkronisasi Terminologi
1. Terminologi UI wajib menggunakan kata "Program" (atau "Program Belajar") alih-alih "Kurikulum", baik pada label antarmuka portal publik, tab staf, tombol aksi, maupun pesan respons API (`"Program berhasil diperbarui"`).
2. Pembaruan program murid dari portal publik (`/api/public/orders/students/:id/curriculum`) wajib memvalidasi parameter route identifier menggunakan `idSchema` (`zValidator("param", z.object({ id: idSchema }))`), dilarang membaca parameter mentah tanpa skema.
3. Pilihan program pada antarmuka publik dan validasi server wajib difilter secara ketat berdasarkan jenjang tingkat kelas murid (`getAvailableCurriculaForGrade`), dilarang menampilkan pilihan program yang tidak relevan dengan jenjang anak.
4. Test suite baru untuk fitur pembaruan portal wajib membersihkan seluruh fixtures data dummy/seeder (`schools`, `students`, `bookPackages`, `studentBookOrders`) pada blok penyelesaian tes (`cleanup`/`finally`) guna menjamin isolasi database pengujian (§6.1).
5. State mutation array murid di view portal wajib dibungkus dalam action hook (`updateSearchResult`), dilarang mengekspos raw array setter (`setSearchResults`) langsung ke komponen antarmuka.

### §0.83. Standar Kelengkapan Form Pendaftaran Murid & Pilihan Program Kanonik
1. **Kelengkapan Identitas Murid**:
   - Seluruh formulir pendaftaran data murid baru, baik pada portal publik (`NewStudentRegistrationForm`) maupun modal manajemen staf (`StudentFormModal`), wajib menyertakan field identitas lengkap:
     - `gender`: Jenis kelamin ("male" / "female", berlabel "Laki-laki (Ikhwan)" / "Perempuan (Akhwat)").
     - `stream`: Pilihan peminatan/jurusan SMA ("IPA" / "IPS") yang dirender secara kondisional hanya untuk jenjang SMA (Kelas 10–12).
     - `intakeType`: Jalur masuk murid pada form staf ("baru" / "kenaikan").
2. **Kanonikalisasi Opsi Program (Anti-Hardcoding)**:
   - Dilarang keras men-hardcode pilihan program hanya ke teks legasi `"Internasional"` dan `"Nasional"`.
   - Opsi program wajib disaring secara data-driven melalui fungsi kanonik `getAvailableCurriculaForGrade(gradeLevel)` (`src/lib/curriculum.ts`), dengan memetakan nilai kanonik Al-Wildan (`INTER`, `MQ`, `AE`, `ME`, `DI`, `TK`). Nilai legasi ("international" / "national") otomatis dinormalisasi via `normalizeCanonicalCurriculum()`.
3. **Penanganan Error Fetching UI**:
   - Seluruh pemanggilan fetching opsi master (seperti pemuatan daftar paket buku pada form pembuatan katalog) wajib menangani error secara visual (misal menampilkan alert error atau retry banner), dilarang menggunakan `catch {}` kosong tanpa penanganan (*no silent catch*, §0.46).

### §0.69. Single-Writer Ekspor CSV & Dekomposisi Shell Drawer Dashboard
1. Seluruh pengunduhan file CSV di antarmuka web klien wajib menggunakan fungsi kanonik tunggal `exportCsvFile` (`src/lib/csv-export.ts`), dilarang merakit inline Blob dan manipulasi elemen `<a>` manual di setiap komponen view/drawer.
2. Drawer drill-down dashboard eksekutif dan view multi-cabang wajib menggunakan shell layout bersama `ExecutiveBreakdownDrawerShell` (`src/components/dashboard/ExecutiveBreakdownDrawerShell.tsx`) guna menjamin konsistensi header, padding, escape modal, dan tombol aksi tanpa duplikasi kode.
3. Tipe data dashboard eksekutif dikelola secara terpusat di `src/lib/dashboard-types.ts`; service backend wajib mengimpor langsung tipe tersebut tanpa deklarasi duplikat di `*-types.ts` lokal.
4. Agregasi piutang (*outstanding debt*) dashboard wajib memanggil predikat kanonik `isOpenOrder(order.paymentStatus)` sebelum menjumlahkan `outstandingOf(order)`, guna mengecualikan pesanan batal atau pesanan yang telah lunas/non-aktif.

### §0.72. Standar Input Numerik & Proteksi Interaksi Angka
1. **Penghilangan Stepper**: Seluruh input angka (`input[type="number"]`) wajib bersih dari *stepper* / *spin-button* bawaan browser desktop secara global via `src/index.css` (`-webkit-appearance: none; appearance: textfield;`).
2. **Proteksi Scroll Wheel**: Cegah perubahan angka tak disengaja saat pengguna menggulir mouse wheel di atas input numerik (`e.preventDefault()` pada target `input[type="number"]`), dilarang memanggil `document.activeElement.blur()` yang mengaborsi fokus pengetikan kursor pengguna.
3. **Proporsi Ruang & Anti-Truncate**: Kotak input angka (Qty, Diskon, dsb.) wajib memiliki lebar minimum yang memadai (minimal `min-w-[50px]` hingga `min-w-[70px]`) dan padding proporsional (`px-1.5` atau `px-2`), menjamin angka multi-digit terlihat utuh tanpa terpotong tepi border.

### §0.74. Standar Pemesanan Seragam Portal Publik & Penyajian Bundel Kain Harian
1. **Bundel Kain Harian Utuh**: Bahan seragam kain harian (kemeja, celana/rok, jilbab/gamis) disajikan sebagai 1 entitas bundel paket utuh per jenjang & gender murid (`uniform_packages`). Pada alur utama Paket Lengkap, dilarang memecah atau mengekspos deretan potongan kain eceran lepasan satu per satu dengan stepper kuantitas bernilai 0.
2. **Default Matching Qty 1**: Saat siswa dipilih di portal seragam, sistem secara otomatis memasang kuantitas default 1 untuk Paket Bahan Seragam Harian dan 1 untuk Seragam Olahraga yang cocok.
3. **Pemisahan Olahraga & Dekopling dari Satuan**: Seragam olahraga adalah pakaian jadi yang berdiri terpisah dari paket bahan kain dan wajib memilih ukuran sebelum checkout. Di awal tahun ajaran, seragam olahraga merupakan bagian integral seragam sekolah yang selalu ditampilkan dan diizinkan dipesan bersama paket bahan kain harian terlepas dari toggle pembelian satuan (`satuanOpen`); guard penutupan satuan admin hanya memblokir pesanan eceran murni tanpa paket.
4. **Segmented Toggle Mode & Validasi Interaktif (§0.63)**: Portal seragam mengadopsi segmented tab `[Paket Lengkap]` dan `[Satuan]` saat `satuanOpen` aktif. Pilihan ukuran seragam olahraga wajib tervalidasi interaktif (border merah dan alert bantuan) saat tombol "Lanjut" diklik. Form pengiriman wajib menyediakan field terpisah untuk Kode Pos 5 digit yang divalidasi ketat dan digabungkan secara aman ke snapshot alamat rumah tanpa regex parser duplikat inline di antarmuka.
5. **Invarian Potensi Perakitan Seragam & Tombol Interaktif (§0.63)**: Pada modul staf perakitan seragam (`UniformAssemblySection`), kalkulasi potensi perakitan paket wajib didelegasikan ke helper domain terpusat `calculateUniformAssemblyPotentialDetails` (`src/lib/uniform-assembly-potential.ts`) yang mengabstraksikan ekstraksi stok varian (`getVariantStockQuantity`). Tombol cepat `Maks (X)` dilarang di-disable secara pasif saat potensi bernilai 0; tombol wajib tetap interaktif dan saat diklik menampilkan umpan balik alasan kegagalan (`potentialInfo.reason` atau peringatan komponen botol leher yang habis) agar staf memahami penyebab fisik paket belum dapat dirakit.
6. **Khimar SD Mandiri & Pilihan Ukuran**: Varian Khimar SD (`jenjang = 'sd'`) diperlakukan seperti seragam olahraga: berdiri terpisah dari bahan kain harian dengan pilihan ukuran (Size 1 atau 4) yang divalidasi ketat saat submit pesanan. Khimar jenjang selain SD tetap mengikuti varian kain harian standar.
7. **Bebas Ongkir Pengiriman Seragam**: Seluruh pengiriman pesanan seragam berstatus bebas ongkir (`shippingCost = 0`). Pengiriman invoice seragam tidak memerlukan input ongkir terlebih dahulu (`gateOnlyWhenLoose: true`).

### §0.76. Standar Ruang Kelas Murid (Rombel) & Agregasi Distribusi Fisik
1. **Representasi Format Kanonik**: Nilai rombel kanonik wajib merepresentasikan kode ruang kelas utuh per jenjang (`1 INTER 1`, `2 INTER 1`, dsb.) agar tidak saling menimpa antar jenjang kelas yang berbeda. Informasi ruang kelas murid disajikan via helper kanonik `formatClassroomName` (`src/lib/classroom.ts`), dilarang merakit string template ad-hoc (`${grade} ${rombel}`) di view atau service pelaporan.
2. **Server-Side Partitioned Filtering & Anti-Collapsing Dropdown**: Filter murid berdasarkan rombel pada antarmuka master murid wajib dikirim ke server (`/api/students?rombel=...`) agar mencakup seluruh populasi murid sekolah tanpa terpotong batas paginasi lokal klien (`LIMIT 50`). Daftar pilihan opsi pada dropdown filter rombel antarmuka dilarang menciut (*anti-collapsing*) saat filter aktif, melainkan wajib mempertahankan himpunan rombel kumulatif yang diketahui dari data sekolah.
3. **Kelengkapan Ekspor CSV Distribusi**: Ekspor laporan breakdown populasi dan pemenuhan siswa (`StudentBreakdownDrawer`) wajib menyertakan rincian pemenuhan per ruang kelas / rombel untuk memandu pembagian fisik buku dan seragam di sekolah cabang.

### §0.79. Disiplin Parser Import & Anti-Heuristik Substring Longgar
1. **Anti-Pencocokan Substring Longgar**: Deteksi header kolom file spreadsheet/CSV (seperti no HP, telepon, nama, email) dilarang menggunakan `includes()` substring pendek (seperti `includes("wa")`, `includes("hp")`, atau `includes("id")`) yang rawan bertabrakan dengan kata lain (misal substring `"wa"` tidak sengaja mencocokkan kolom `"nama siswa"` atau alias `"wali"`). Gunakan pencocokan kata utuh yang eksplisit (`=== "no wa"`, `=== "no hp"`, `=== "telepon"`).
2. **Kanonikalisasi Validasi Email**: Sanitasi format email pada parser import data wajib memanfaatkan helper kanonik `validateEmail` (`src/lib/form-validation.ts`), dilarang menduplikasi instansiasi regex email ad-hoc di dalam loop baris data.
3. **Isolasi State Test DOM**: Uji coba komponen klien yang memanipulasi atau me-monkeypatch metode browser global (seperti `document.createElement`, `fetch`, `localStorage`, atau `window.location`) wajib dibungkus blok `try ... finally` atau dipulihkan di hook `afterEach` guna mencegah kebocoran state antar test.

### §0.85. Resolusi Judul Publik & Penyajian Harga Paket Buku Portal
1. **Fallback Judul Publik Buku**: Resolusi judul buku di seluruh endpoint publik (`/packages`, `/book-choices`, `/satuan-catalog`) wajib menggunakan helper kanonik `resolvePublicBookTitle` (`src/lib/book-pricing.ts`). Jika `publicTitle` tidak diisi (null, undefined, atau string kosong setelah di-trim), sistem wajib fallback ke judul asli buku (`book.title`), dilarang membubuhi fallback hardcoded ad-hoc (seperti `"Buku Paket"`) yang membingungkan orang tua/murid. Khusus untuk WPR, tetap menggunakan `WPR_TITLE`.
2. **Penyembunyian Harga Satuan Buku Paket**: Pada rincian isi paket (`PackageBreakdown`), antarmuka orang tua hanya menyajikan daftar judul dan kuantitas eksemplar (`X eks`), dilarang menampilkan nominal harga satuan buku di dalam rincian paket guna menjaga fokus orang tua pada total harga paket dan mencegah kerancuan harga satuan yang berbeda dari harga bundling paket. Harga satuan buku hanya disajikan pada katalog & alur pemesanan buku satuan.

### §0.88. Pemesanan Tanpa Stopper Stok, Low-Stock Warning, & Partisi Ukuran Seragam (ADR-0024)
1. **Zero-Stock Order Permitted**: Ketiadaan stok fisik (saldo 0 atau shortfall) di portal publik dilarang menjadi stopper checkout pesanan buku maupun seragam. Pesanan masuk tercatat sah dengan status logistik `belum_dikirim` / `waiting_preparation`. Mutasi stok seragam checkout memakai policy `"create"` agar record stok aman terbuat/negatif tanpa error constraint.
2. **Penyembunyian Angka Stok Publik & Konfigurasi Low-Stock Warning**: Angka nominal kuantitas sisa stok fisik (`"Stok: X"`, `"Siap kirim: X"`) dilarang ditampilkan ke antarmuka publik portal pemesanan orang tua. Peringatan persediaan konveksi di portal seragam publik dinonaktifkan secara default (`uniform_portal_show_low_stock_warning = false`), dan hanya muncul bila diaktifkan secara eksplisit oleh staf melalui toggle di pengaturan sistem.
3. **Pre-seleksi & Default Qty Khimar SD**: Siswi SD kelas 1 & 2 wajib ter-preseleksi ukuran Khimar SD **Size 1**, dan siswi SD kelas 3 s/d 6 ter-preseleksi **Size 4** via `getDefaultKhimarSdSize` (`src/lib/khimar-sd.ts`), sekaligus menginisialisasi kuantitas default 1 untuk setiap varian Khimar SD akhwat di tab Paket Lengkap. Normalisasi tingkat kelas wajib robust terhadap prefix seperti "SD", "Kelas", atau suffix rombel. Dropdown ukuran di portal tetap fleksibel dapat diganti oleh orang tua, dan kuantitas yang telah dipilih wajib dimigrasikan ke kunci ukuran baru tanpa me-reset ke 0.
4. **Partisi Ukuran Olahraga Sesuai Jenjang**: Dropdown pilihan ukuran seragam olahraga dan modal panduan ukuran (*size chart guide*) wajib difilter ketat hanya menampilkan rentang ukuran resmi jenjang siswa (`getOfficialSportSizesForJenjang` di `src/lib/uniform-size-chart.ts`: TK: S–XL, SD: S–4XL, SMP: S–5XL, SMA: S–5XL). Siswa SD dilarang melihat opsi 5XL, dan siswa TK dilarang melihat ukuran di atas XL. Pada paket BOM dengan seragam olahraga, opsi ukuran wajib memprioritaskan irisan ukuran resmi jenjang siswa tanpa fallback yang membocorkan ukuran luar jenjang. Konstanta size chart dideklarasikan mandiri per jenjang (`TK_SIZE_CHART`, `SD_SIZE_CHART`, `SMP_SIZE_CHART`, `SMA_SIZE_CHART`).

### §0.95. Standarisasi Paginasi & Pencarian Ter-Debounce pada Tampilan Tabular (ADR-0027)
1. **Navigasi Halaman Kanonik**: Seluruh tampilan tabular dan list data transaksional/operasional bervolume tinggi (`StudentOrdersView`, `UniformShipmentSection`, `ProcurementView`, `InternalProcurementView`, `BookReturnsView`, `CatalogView`, `PackagesView`, `InventoryView`) wajib menggunakan komponen UI kanonik `TablePagination` (`src/components/ui/TablePagination.tsx`) dengan mikro-interaksi `active:scale-[0.98]` dan proteksi rentang baris (`effectivePage`). Dilarang membuat tombol paginasi inline atau navigasi Previous/Next ad-hoc.
2. **Helper Pemotong Data Klien**: Paginasi di sisi klien yang menerima array utuh wajib menggunakan fungsi pemotong kanonik `paginateItems` (`src/components/ui/useTablePagination.ts`), bukan slice manual tersebar.
3. **Pencarian Ter-Debounce & Anti-Race Condition**: Seluruh input pencarian pada tabel yang dipaginasi wajib memanfaatkan custom hook kanonik `useDebouncedSearch` (`src/lib/useDebouncedSearch.ts`) dengan jeda ~300ms. Perubahan debounced query atau filter status/sekolah wajib langsung mereset `page = 1` tanpa memicu double fetch atau race condition respon usang.
4. **Sanitasi Parameter Paginasi Server-Side**: Endpoint server yang mendukung paginasi wajib memanfaatkan helper kanonik `parsePaginationParams` (`src/server/lib/validators.ts`) untuk memastikan batasan `page >= 1` dan `1 <= limit <= 100` seragam tanpa duplikasi manual.

### §0.96. Ergonomi UI, Anti-Occlusion Navigasi, & Responsivitas Desktop
1. **Anti-Occlusion Bottom Navigation**: Seluruh kontainer halaman/view utama yang memiliki navigasi bawah fixed (`AppMobileNavigation`) wajib memiliki padding-bottom yang cukup (`pb-28` atau minimal `pb-24` di layar mobile, dan `pb-8` atau `pb-10` di desktop) agar konten terbawah (seperti kartu ringkasan, tombol submit, atau baris tabel terakhir) tidak pernah tertutup atau terpotong oleh bilah navigasi.
2. **Label Menu Anti-Truncate**: Elemen tombol pada navigasi mobile wajib menjaga whitespace label (`whitespace-nowrap`) dengan kontainer scroll horizontal yang mulus (`overflow-x-auto scrollbar-none`) dan padding seimbang, dilarang membatasi lebar kaku yang memicu pemotongan teks nama modul (`truncate`) yang membingungkan staf.
3. **Lebar Konten Desktop (Fluid Layout)**: Area konten utama antarmuka staf pada layar monitor/laptop desktop (breakpoint `>= md` atau `1280px+`) wajib memanfaatkan lebar yang proporsional (`max-w-7xl` atau fluid) dan dilarang dikompresi ke dalam container mobile sempit (`max-w-md` atau `max-w-xl`) yang memicu kompresi kolom dan pergeseran tombol aksi ke luar layar.
4. **Resiliensi Tabel & Sticky Actions**: Kolom kunci identitas (seperti No. Order) dan kolom aksi pada tabel padat data wajib menerapkan `whitespace-nowrap`. Kolom aksi pada tabel lebar wajib dibuat `sticky right-0` dengan background solid dan bayangan pemisah lembut agar staf tidak kehilangan akses tombol aksi operasional saat melakukan scroll horizontal.
5. **Anti-Wrap Tab Navigasi Publik**: Baris tab navigasi portal publik (`PortalTabs`) wajib mendukung penataan rapi horizontal di desktop dan scroll mendatar di layar sempit (`flex-wrap sm:flex-nowrap overflow-x-auto`) sehingga tidak membungkus item tab ke baris baru sendirian.







