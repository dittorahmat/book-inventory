# ADR-0022: Manajemen Edit-Delete Data Master Katalog dan Pembatasan Buku Satuan Terkunci BOM

## Context

Sebelumnya antarmuka staf memiliki keterbatasan fungsionalitas CRUD data master:
1. Sebagian besar entitas katalog (murid, buku, seragam, paket) baru memiliki opsi hapus (delete) dan belum memiliki antarmuka edit (update) yang lengkap di UI staf.
2. Penghapusan data berisiko merusak integritas relasional database jika entitas yang dihapus telah mengikat riwayat transaksi, alokasi fisik barang di gudang, atau mutasi finansial kasir/bank.
3. Seluruh paket buku sebelumnya bersifat global/tanpa isolasi sekolah, padahal antar cabang (misal: Al Wildan 1 vs Al Wildan 4) terdapat perbedaan kebutuhan kurikulum dan komposisi paket buku.
4. Katalog pembelian buku satuan di portal publik menampilkan daftar buku secara terbuka tanpa mengaitkan ke kurikulum atau jenjang murid yang bersangkutan, sehingga murid berisiko memesan buku yang salah atau tidak relevan.

## Decision

1. **Lingkup Entitas Master (Data Induk)**:
   - Edit dan Delete difokuskan secara ketat pada Data Induk: Murid (`students`), Buku Katalog (`books`), Paket Buku (`book_packages`), Varian Seragam Satuan (`uniform_variants`), Paket Seragam (`uniform_packages`), Pemasok (`suppliers`), dan Sekolah/Cabang (`schools`).
   - Entitas transaksi operasional (pesanan buku/seragam, struk bank, mutasi transfer internal) tidak dapat di-edit/delete mentah, melainkan mengikuti alur bisnis kanonik (*superseded*, retur pengunduran diri, rekonsiliasi).

2. **Invarian Integritas & Guard Penghapusan (Foreign Key Dependency Guard)**:
   - Penghapusan entitas master hanya diizinkan bila entitas tersebut **belum pernah memiliki relasi transaksi atau stok fisik aktif**.
   - Murid dengan riwayat pesanan, Buku dengan eksemplar fisik `book_items`, atau Varian Seragam dengan saldo stok `uniform_stock` > 0 dicegah dari penghapusan dan diberi respon peringatan yang jelas.

3. **Invarian Pengeditan Murid & Penetapan Harga**:
   - Field `school_id` dan `grade_level` pada data Murid dikunci (*disabled*) jika murid telah memiliki pesanan aktif/selesai demi menghindari alokasi stok cabang yang menggantung (*orphan allocation*).
   - Perubahan harga katalog buku atau varian seragam hanya berlaku efektif untuk pesanan baru di masa mendatang; pesanan berjalan mempertahankan snapshot harga saat pemesanan.

4. **Penugasan Paket Buku per Cabang (`book_package_schools`)**:
   - Dibuat tabel relasi penugasan cabang `book_package_schools` (`package_id` ↔ `school_id`).
   - Paket tanpa penugasan cabang berlaku universal untuk semua cabang sekolah.
   - Paket yang di-assign ke cabang tertentu eksklusif hanya muncul dan dapat dipilih oleh murid di cabang tersebut.

5. **Katalog Satuan Terkunci BOM & Override Admin (`school_grade_allowed_books`)**:
   - Pilihan buku satuan untuk murid dibatasi secara otomatis hanya pada buku yang terdaftar di dalam Bill of Materials (BOM) paket jenjang & sekolah murid tersebut.
   - Disediakan tabel relasi whitelist `school_grade_allowed_books` (`school_id`, `grade_level`, `book_id`) agar Admin Pusat dapat memberikan izin (*override*) pembelian buku satuan tambahan di luar paket reguler untuk jenjang/sekolah tertentu.

6. **Konsistensi BOM Paket & Antarmuka**:
   - Pengeditan komponen paket buku/seragam memicu rekalkulasi harga otomatis dan membongkar (*auto-unbundle*) bundel belum terdistribusi via single-writer `package-mutation.ts`.
   - Seluruh interaksi edit data disajikan melalui Slide-over Sheet / Modal Dialog Pop-up dengan validasi schema Zod.

## Consequences

- **Positif**:
  - Admin memiliki kendali penuh untuk mengelola dan memutakhirkan data master tanpa takut merusak pembukuan akuntansi dan alokasi stok logistik.
  - Setiap cabang Al-Wildan dapat memiliki paket buku yang disesuaikan secara fleksibel.
  - Murid tidak lagi kebingungan atau salah memesan buku satuan karena pilihannya terkunci sesuai kurikulum paket kelasnya.
- **Trade-off**:
  - Memerlukan migrasi skema D1 untuk tabel `book_package_schools` dan `school_grade_allowed_books`.
  - Filter katalog satuan publik perlu menerima konteks identitas murid (`schoolId` & `gradeLevel`) untuk menyaring buku yang relevan.
