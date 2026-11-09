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

### §0.28. Integritas Sinkronisasi Harga Paket & WPR BOM
Setiap paket buku yang mengandung WPR di BOM (`book-wpr-weekly-report`) wajib menghitung total harga paket (`book_packages.price`) secara all-in melalui seam `recalcPackagePrice` (SUM seluruh harga jual komponen termasuk WPR); pada penyajian publik (portal murid/wali), item WPR wajib menyajikan judul resmi `Weekly Progress Report (WPR)` dan dilarang disamarkan menjadi teks generik (`Buku Paket`). Penyedia baris buku wajib (`ensureWprBook`) wajib idempoten dengan `onConflictDoUpdate` agar kolom `publicTitle` dan harga selalu tersinkronkan pada database lama maupun baru. Pengaturan nominal WPR wajib dikelola terpusat di `system_settings` (`book_wpr_price`) melalui seam kanonik `saveWprPriceSetting` yang secara otomatis memperbarui baris buku WPR dan menghitung ulang seluruh paket terkait, serta dilindungi otorisasi role logistik (`assertSettingsAdmin(c, "pricing")`). Setiap pembuatan paket buku (baik manual maupun otomatis) wajib memastikan injeksi komponen WPR BOM. Setiap perubahan mapping DTO katalog publik wajib disertai unit regression test di `public-orders.test.ts`.

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

### §0.59. Disiplin Auto-Populate Pengadaan PO & Demand Siswa (Buffer Pesanan)
1. **Kanonikalisasi Formula Kebutuhan PO Siswa**: perhitungan jumlah pesanan PO berbasis siswa wajib memakai helper kanonik `calcDemandQty(studentCount, bufferPercent)` (`src/components/procurement/po-demand-helpers.ts` dan `src/server/services/purchase-order/demand.ts`) yang menerapkan pembulatan ke atas (`Math.ceil(studentCount * (1 + buffer / 100))`), dilarang menduplikasi formula perhitungan inline di berbagai view.
2. **Pencegahan Silent Overwrite, Strict Supplier & Item Kosong**: modal penerbitan PO (`CreatePOModal.tsx`) menyaring buku strictly hanya yang terdaftar pada supplier terpilih via `filterSupplierEligibleBooks` (buku tanpa supplier dilarang bocor sebagai universal). Baris item buku di-populate otomatis hanya untuk buku ber-demand aktif siswa (`studentCount > 0`); pengguna tetap dapat menambah buku lain via tombol manual. Nilai manual `editedBookIds` wajib dipertahankan saat persentase buffer berubah; saat submit form PO, item dengan `quantityOrdered === 0` wajib disaring otomatis.
3. **Validasi Query & Proteksi Akses Demand**: endpoint kalkulasi kebutuhan buku (`/api/procurement/book-demand-summary`) wajib memvalidasi parameter query via `zValidator("query", ...)` dan dikunci aksesnya dengan `requireScopedLogisticsActor` (menolak peran non-logistik dengan HTTP 403).
4. **Kelengkapan UI Dialog Konfirmasi & Filter Staf**: alur wizard intake portal publik (buku dan seragam) wajib mengintegrasikan dialog konfirmasi (`PendingOrderConfirmModal`) saat terdeteksi pesanan gantung untuk memberi pilihan eksplisit "Ganti Pesanan Lama" atau "Buat Pesanan Baru". Tampilan tabel staf (`StudentOrdersTable` dan `UniformShipmentSection`) wajib menyediakan filter dan badge status `superseded`.
