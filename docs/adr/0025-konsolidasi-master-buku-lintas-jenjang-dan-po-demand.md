# ADR 0025: Konsolidasi Master Buku Lintas Jenjang, Fallback ISBN Deterministik, dan Rincian Sub-Jenjang PO

## Status
Accepted

## Konteks
Pada analisis data sumber katalog kurikulum Al-Wildan TA 2026/2027 (Google Drive `152wjA7d62NmlnRhNAkdR_FNX1igGf4wQ`), ditemukan bahwa:
1. Banyak buku pelajaran, ibadah, dan administrasi siswa yang dipakai bersama di beberapa jenjang sekaligus (misal: `"QC IBADAH DAN AKHLAK"`, `"BUKU PENILAIAN TAHSIN DAN TAHFIZH"`, `"QOIDAH NUROONIYAH"`, `"PROGRAM WEEKLY PROGRESS REPORT 1 TAHUN"` yang dipakai dari SD hingga SMA, serta seri `"KHAT 1"`, `"KHAT 2"`, `"KHAT 3"`, dan `"BAHASA ARAB ABY"`).
2. Data masukan katalog dari sekolah/supplier sering kali tidak menyertakan nomor ISBN resmi atau kode buku unik.
3. Saat melakukan pengadaan buku ke supplier, stok fisik buku yang sama harus dipesan secara akurat, namun tim logistik dan supplier membutuhkan visibilitas alokasi untuk masing-masing jenjang/tingkat kelas siswa pemesan.

## Keputusan

### 1. Konsolidasi Global Master Buku (Single Physical SKU Across Packages)
- Buku dengan judul dan harga fisik yang sama dikonsolidasikan menjadi **satu entitas buku fisik global** di tabel `books`.
- Saldo persediaan gudang fisik di `book_stocks` dikelola secara agregat untuk buku tersebut tanpa fragmentasi per jenjang.
- Pengkaitan ke jenjang (`grade_level`) dan kurikulum (`curriculum_type`) didelegasikan ke entitas paket (`book_packages`) melalui relasi Bill of Materials (`book_package_items`).
- Antarmuka (View, Input, Edit, Impor) katalog buku harus merefleksikan model konsolidasi ini:
  - Form edit/view master buku tidak mengunci buku ke satu kelas/jenjang tunggal jika buku tersebut berstatus dipakai lintas paket.
  - Tampilan detail katalog buku menampilkan daftar paket dan jenjang yang mengadopsi buku tersebut (*reusable package linkages*).

### 2. Kode Buku Internal Unik & Deterministik (Fallback ISBN)
- Apabila input data katalog tidak menyertakan nomor ISBN resmi, sistem **wajib** menghasilkan kode buku internal yang deterministik dan unik.
- Algoritma fallback (`resolveBookIsbn` / `slugifyBookCode`) mengombinasikan normalisasi judul buku, harga, dan hash deterministik (misalnya `BK-JUDUL-BUKU-<PRICE_OR_HASH>`) untuk mencegah tabrakan ID maupun pemecahan identitas buku yang tidak diinginkan saat impor berkala.
- Jika ada buku dengan judul mirip tetapi fisik berbeda, pembedaan diwajibkan melalui variasi judul resmi (misal: "Bahasa Arab TK" vs "Bahasa Arab SD") atau nomor ISBN khusus.

### 3. Rincian Sub-Jenjang pada PO Demand Supplier
- Pada fitur pengadaan buku ke supplier (*Purchase Order Demand*), sistem menampilkan agregasi total kebutuhan fisik buku per supplier/cabang.
- Setiap baris pemesanan buku yang dipakai lintas jenjang dilengkapi informasi rincian pemenuhan sub-jenjang (misalnya: *Total 150 eks: SD 80, SMP 40, SMA 30*) agar memudahkan supplier dalam pemilahan/pengepakan dan membantu petugas logistik saat verifikasi penerimaan barang fisik.

## Konsekuensi
- **Positif**:
  - Saldo stok fisik gudang akurat dan tidak terpecah-pecah (tidak ada situasi di mana gudang kehabisan stok "QC Ibadah SD" padahal ada stok berlebih "QC Ibadah SMP").
  - Impor katalog buku aman dari duplikasi (*deduplicated*).
  - PO supplier lebih informatif dengan pembagian jenjang yang jelas tanpa mengorbankan konsolidasi pemesanan.
- **Negatif / Hal yang Harus Diperhatikan**:
  - Validasi UI saat menghapus atau mengubah harga master buku harus memperingatkan pengguna jika buku tersebut terikat pada paket di beberapa jenjang sekaligus.
