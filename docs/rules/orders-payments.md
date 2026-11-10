# Aturan Pesanan & Keuangan

Dokumen ini memuat aturan kanonik dan mandat anti-kambuh untuk alur pesanan buku/seragam, kasir, alokasi pembayaran, rekonsiliasi mandiri, serah terima fisik, komplain, serta retur/pembatalan pengunduran diri.

---

## Mandat Anti-Kambuh

### §0.4. Struk Bayar & Single-Writer Payment Ledger
Satu pembentuk baris (`payment-ledger`) dan satu pembaca; baris `payment_receipts`/`payment_allocations` hanya boleh dimutasi lewat modul itu (`check:single-writer`). Duplikat kombinasi bank + referensi menghasilkan respon status 409 Conflict.

### §0.5. Kelayakan Order
Satu aturan kelayakan murid untuk buku dan seragam (`student-eligibility`); pencarian murid di portal wajib membawa predikat `canOrder` yang identik dengan penegakan validasi submit pesanan di backend.

### §0.21. Disiplin Seam Tinjau Pembayaran & Kasir
Seluruh mutasi pembayaran kasir manual dan verifikasi klaim bukti transfer (buku maupun seragam) wajib memusat ke `order-payment-review` (`src/server/services/order-payment-review.ts`). Parameter alokasi kanonik pada level service adalah `allocationAmount` (alias backward-compatible `bookAllocationAmount` dinormalisasi di pintu masuk schema validator tanpa membiarkan primitive obsession merembes ke domain internal).

### §0.22. Integritas Seam Siklus Hidup Murid & Verifikasi
Seluruh transisi status pendaftaran siswa (`new_pending` → `active`/`rejected`) dan penegakan keunikan NIS resmi wajib tinggal di balik modul layanan `student-lifecycle` (`src/server/services/student-lifecycle.ts`), dilarang melakukan query mutasi SQL langsung (`UPDATE students`) dari handler router.

### §0.28. Integritas Sinkronisasi Harga Paket, WPR BOM & Non-Fisik Universal
1. **Perhitungan All-In & Konsolidasi Kanonik**: Setiap paket buku yang mengandung WPR di BOM wajib menggunakan entitas kanonik tunggal `book-wpr-weekly-report` (`WPR_BOOK_ID`, ISBN `WPR-750K`) dan menghitung total harga paket (`book_packages.price`) secara all-in melalui seam `recalcPackagePrice`.
2. **Penyajian Publik & Metadata**: Pada penyajian publik (portal murid/wali), item WPR wajib menyajikan judul resmi `Weekly Progress Report (WPR)` dan dilarang disamarkan menjadi teks generik (`Buku Paket`). Pada antarmuka stok inventori/gudang, WPR disajikan dengan badge penanda `Layanan Non-Fisik` agar staf tidak menuntut perhitungan fisik rak.
3. **Penyedia Idempoten & Pengaturan Terpusat**: Penyedia baris buku wajib (`ensureWprBook`) wajib idempoten dengan `onConflictDoUpdate`. Pengaturan nominal WPR dikelola terpusat di `system_settings` (`book_wpr_price`) melalui seam kanonik `saveWprPriceSetting` yang secara otomatis memperbarui baris buku WPR dan merambatkan harga ke seluruh paket terkait, dilindungi otorisasi `assertSettingsAdmin(c, "pricing")`.
4. **Bypass Kitting Stok Fisik Universal**: WPR adalah layanan non-fisik (administrasi mingguan); seam perakitan paket (`kitBomWithoutWpr`, `assemblePackageBundles`, `disassemblePackageBundles`, `getStockPotentials`, `auto-kit`) wajib mengecualikan komponen WPR secara universal via helper kanonik `isWprBook` sehingga perakitan paket buku di semua jenjang dan program tidak pernah menuntut atau memotong saldo fisik `book_stocks`. Dilarang membuat entri duplikat WPR per jenjang di katalog buku.

### §0.29. Disiplin Rekonsiliasi Mandiri & Guard Serah Terima Buku (ADR-0018)
Intake pesanan buku portal publik (`/api/public/orders/submit`) berfungsi sebagai self-service confirmation & reconciliation ledger:
1. Alokasi transfer penuh langsung berstatus `paid` (dengan nominal `paidAmount` riil alokasi yang dibayar), alokasi sebagian langsung berstatus `partial` (cicilan), dan beasiswa valid langsung `scholarship_approved`.
2. Aturan kelayakan penyerahan buku fisik wajib memusat ke helper kanonik tunggal `canHandoverBookOrder` (`src/lib/order-handover-guard.ts`) yang dipakai bersama oleh server (`order-handover.ts`) dan klien UI (`StudentOrdersTable.tsx`), dilarang menduplikasi predikat status inline di view maupun handler. Ditegakkan mekanis oleh `check:canonical-helpers`.
3. Penyerahan fisik diizinkan bagi pemegang Bukti Pengambilan dengan status `paid`, `partial`, `scholarship_approved`, atau diskresi finance; status `unpaid` murni (tanpa bukti bayar/diskresi) tetap ditahan.

### §0.31. Integritas Alur Retur & Pembatalan Pengunduran Diri (ADR-0019)
Pembatalan pesanan akibat siswa mengundurkan diri (buku maupun seragam) wajib memisahkan wewenang fisik dan finansial:
1. Verifikasi bukti fisik / resi kurir / surat resmi berada di bawah wewenang Gudang, sedangkan pencairan dana refund berada di bawah wewenang Finance via modul kanonik `payment-ledger` berbasis Slip Bukti Pengembalian resmi (`RET-B-*` / `RET-U-*`).
2. Metadata pelacakan retur dokumen/resi dilarang dipadatkan ke string `notes` atau `reason` (patuh §0.10).
3. Pada pembatalan buku yang belum diserahterimakan, alokasi fisik (paket `package_items` maupun buku satuan `book_items`) wajib di-unassign menjadi stok bebas cabang secara otomatis dalam batch transaksi yang sama.
4. Komponen klien yang memanggil endpoint alamat atau informasi gudang dilarang melakukan silent-catch (`.catch(() => {})`) dan wajib menampilkan pesan error yang ramah pengguna. Ditegakkan mekanis oleh `check:no-silent-catch`.

### §0.35. Integritas Resolusi Foreign Key Pembatalan Dokumen (ADR-0019)
Pada pembuatan baris dokumen retur/batal (`book_returns`) akibat siswa mengundurkan diri yang belum memiliki alokasi fisik, kolom `defectiveBookId` wajib diisi melalui resolusi deterministik: BOM paket pertama bila ada, baris satuan pertama bila ada, atau fallback komponen wajib katalog (`WPR_BOOK_ID`) untuk menjamin kepatuhan Foreign Key integritas relasional tanpa memasukkan ID arbitrer atau string kosong.

### §0.38. Seam Terpadu Pengunduran Diri Murid (ADR-0019)
Seluruh intake pembatalan pesanan akibat murid mengundurkan diri (buku maupun seragam) wajib memusat ke seam polimorfik `requestStudentWithdrawal` (`src/server/services/student-withdrawal.ts`), dilarang membuat handler intake pembatalan terpisah langsung di router ataupun memanggil sub-layanan spesifik buku/seragam secara terisolasi. Seam terpadu ini wajib menjadi otoritas validasi domain kanonik bersama (misal keabsahan data murid dan panjang alasan pembatalan) sehingga bertindak sebagai deep module substantif dan bukan sekadar *middle-man pass-through*.

### §0.50. Disiplin Formatter Error Validasi & Fleksibilitas Identifikasi Katalog
1. **Ekstraksi Error Validasi Zod Ramah Pengguna**: seam fetch klien (`readJson` di `src/lib/api.ts`) wajib mengekstrak issue validasi terstruktur (`error.issues` / `payload.issues`) menjadi pesan teks kalimat yang ramah pembaca (`field: message; ...`), dilarang membiarkan objek error terevaluasi menjadi string default `[object Object]` pada alert atau modal antarmuka pengguna.
2. **Kanonikalisasi Fallback Identifier Buku (ISBN)**: input nomor ISBN katalog bersifat opsional bagi pengguna dengan format fleksibel (tidak kaku 10/13 digit); bila dikosongkan, resolusi identifier wajib memusat ke helper kanonik `resolveBookIsbn` (`src/lib/isbn.ts`) yang menghasilkan prefix `AUTO-${stamp}-${serial}` secara deterministik guna menjaga keunikan constraint relasional SQLite/D1 (`books.isbn NOT NULL UNIQUE`) tanpa perakitan string inline di handler router.

### §0.53. Integritas Alur Penggantian Pesanan Gantung & Realokasi Pembayaran (ADR-0021)
1. **Kepatuhan Single-Writer pada Realokasi Alokasi Dana**: mutasi kolom `orderId` pada tabel `payment_allocations` wajib memusat ke helper kanonik `reallocateAllocationQuery` di modul pemilik tunggal `payment-ledger.ts`, dilarang mengeksekusi `database.update(paymentAllocations)` secara langsung di luar modul ledger. Ditegakkan mekanis oleh `check:single-writer`.
2. **Anti-Error Swallowing pada Handler Router Penggantian**: pemanggilan orchestrator penggantian pesanan (`handleOrderReplacement`) pada router intake publik (`/api/public/orders/submit` dan `/api/public/uniform-orders/orders`) wajib memeriksa status hasil (`rep.ok`); bila proses supersede atau realokasi gagal, handler dilarang mengabaikan error dan wajib mengembalikan response HTTP error eksplisit (400/404/409).
3. **Kohesi Route Pre-Order Intake**: endpoint pendeteksian pesanan gantung (`GET /check-pending/:studentId`) adalah alur intake pemesanan baru, wajib didaftarkan di router intake pesanan (`publicOrdersRouter`), dilarang ditempatkan di sub-router komplain retur (`publicOrderReturnsRouter`).

### §0.59. Disiplin Auto-Populate Pengadaan PO & Demand Siswa (Buffer Pesanan & Net Demand)
1. **Kanonikalisasi Formula Kebutuhan PO Siswa**: perhitungan jumlah pesanan PO berbasis kebutuhan bersih (net demand) wajib memakai helper kanonik tunggal di `src/lib/po-demand.ts` (`calcBufferQty`, `calcDemandQty`, dan `resolveInitialOrderQty`). Formula memperhitungkan stok fisik lepas gudang:
   $$\text{Up Buffer} = \lceil \text{studentCount} \times (1 + \text{buffer} / 100) \rceil$$
   $$\text{Net Demand} = \max(0, \text{Up Buffer} - \text{warehouseStock})$$
   Dilarang menduplikasi formula perhitungan inline di berbagai view maupun backend service.
2. **Auto-Populate Seluruh Buku Supplier & Nilai Awal**: modal penerbitan PO (`CreatePOModal.tsx`) menyaring buku strictly hanya yang terdaftar pada supplier terpilih via `filterSupplierEligibleBooks`. Saat supplier dipilih, seluruh judul buku supplier langsung di-populate ke tabel item PO:
   - Buku ber-demand siswa (`studentCount > 0`) diisi hasil $\text{Net Demand}$.
   - Buku tanpa demand siswa (`studentCount = 0`) dengan stok gudang kosong (0) diisi default `DEFAULT_EMPTY_STOCK_ORDER_QTY` (10); bila stok gudang sudah ada diisi 0.
   - Dropdown manual "Tambah Judul Buku" wajib menyaring buku yang sudah ada di tabel untuk mencegah duplikasi baris, dan tombol tambah dinonaktifkan saat seluruh buku supplier sudah masuk ke tabel.
   - Nilai manual `editedBookIds` wajib dipertahankan saat persentase buffer berubah; saat submit form PO, item dengan `quantityOrdered === 0` disaring otomatis.
3. **Validasi Query & Proteksi Akses Demand**: endpoint kalkulasi kebutuhan buku (`/api/procurement/book-demand-summary`) wajib memvalidasi parameter query via `zValidator("query", ...)` dan dikunci aksesnya dengan `requireScopedLogisticsActor` (menolak peran non-logistik dengan HTTP 403).
4. **Layout Kolom Pembuktian Logistik & Anti-Overflow**: baris item PO (`PoItemRow.tsx`) wajib menyajikan breakdown transparan (Siswa, Up Buffer, Stok Gudang, Qty Pesan). Pemilih buku `SearchableSingleSelect` wajib menerapkan `min-w-0` dan pemotongan teks `truncate` agar judul buku yang sangat panjang tidak meluap keluar grid atau menutupi kotak kuantitas pesanan di sebelahnya.
5. **Kelengkapan UI Dialog Konfirmasi & Filter Staf**: alur wizard intake portal publik (buku dan seragam) wajib mengintegrasikan dialog konfirmasi (`PendingOrderConfirmModal`) saat terdeteksi pesanan gantung untuk memberi pilihan eksplisit "Ganti Pesanan Lama" atau "Buat Pesanan Baru". Tampilan tabel staf (`StudentOrdersTable` dan `UniformShipmentSection`) wajib menyediakan filter dan badge status `superseded`.

### §0.70. Integritas Perhitungan Piutang & Pembedaan Kolom Status Pesanan Buku vs Seragam
1. **Dua Kolom Status Pesanan Buku**: pada skema `student_book_orders`, status pelacakan fisik adalah `fulfillmentStatus` (enum: `waiting_preparation`, `ready_for_pickup`, `picked_up`, dll.), sedangkan status keuangan adalah `paymentStatus` (enum: `unpaid`, `partial`, `paid`, dll.). Dilarang mengasumsikan kolom `shipmentStatus` pada tabel pesanan buku (kolom `shipmentStatus` hanya ada pada pesanan seragam `uniform_orders`).
2. **Kanonikalisasi Guard Piutang (Outstanding Debt)**: akumulasi angka piutang pesanan buku (`outstandingOf`) wajib memvalidasi status pesanan terbuka via predikat kanonik `isOpenOrder(order.paymentStatus)` (`src/server/services/stock/buckets.ts`). Pesanan non-open, batal (`cancelled`), atau superseded dilarang diakumulasikan ke dalam piutang.
