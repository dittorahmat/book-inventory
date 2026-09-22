# PANDUAN PENGGUNA (USER MANUAL)
## Sistem Manajemen Inventaris & Logistik Buku Sekolah

---

## 1. Pendahuluan
Aplikasi **School Book Inventory & Logistics System** adalah sistem terpusat untuk mengelola siklus hidup buku fisik di sekolah multi-cabang. Sistem ini menghubungkan Kantor Pusat / Gudang Utama (*Headquarters*) dengan cabang-cabang sekolah (*Branch Schools*).

Sistem memastikan:
- Setiap buku fisik dilacak melalui **Barcode / Asset Tag unik**.
- Pergerakan buku antar cabang tercatat melalui surat jalan pengiriman (*Transfer Shipments*).
- Status fisik buku terpantau (`New`, `Good`, `Fair`, `Damaged`) sehingga cabang dapat menyortir dan meretur buku rusak dengan cepat.

---

## 2. Hak Akses & Pemilihan Cabang Aktif
1. **Pengguna Kantor Pusat (*Central Admin*)**:
   - Memiliki visibilitas penuh ke semua cabang sekolah.
   - Dapat berpindah tampilan cabang melalui dropdown **Branch Selector** di header kanan atas.
2. **Pengguna Admin Cabang (*Branch Admin*)**:
   - Terisolasi hanya untuk mengelola stok unit dan mutasi yang bersangkutan dengan cabang sekolahnya.

---

## 3. Modul Book Catalog (Katalog Buku Utama)
Modul ini digunakan untuk mendaftarkan master data buku sebelum eksemplar fisik dicetak.

### 3.1 Mencari Buku di Katalog
- Gunakan kolom **Search bar** di bagian kanan atas katalog.
- Ketik judul buku, nomor ISBN, nama pengarang, atau nama penerbit.
- Tabel akan menyaring data buku secara instan tanpa memuat ulang halaman (*real-time filter*).

### 3.2 Menambahkan Judul Buku Baru & Upload Cover
1. Klik tombol **`+ Add Title`** di sudut kanan atas.
2. Form pendaftaran judul buku akan terbuka:
   - **Upload Book Cover**: Klik area upload gambar bertanda putus-putus. Pilih gambar cover (format PNG, JPG, atau WebP). Sistem akan langsung menampilkan live preview.
   - **ISBN**: Masukkan nomor ISBN unik (misal: `978-0131103627`).
   - **Title**: Masukkan judul lengkap buku.
   - **Author**: Masukkan nama pengarang buku.
   - **Publisher**: Masukkan nama penerbit.
3. Klik tombol **`Save Book`**.
4. Sistem otomatis menyimpan metadata buku dan mengupload file cover secara terpadu (*one-click save*).

### 3.3 Menambahkan Salinan Fisik (*Generate Physical Copies*)
1. Pada baris buku yang diinginkan di tabel katalog, klik tombol **`Add Physical Copies`**.
2. Masukkan jumlah eksemplar yang ingin dicetak/didaftarkan ke sekolah aktif.
3. Klik **`Generate & Barcode`**.
4. Sistem akan otomatis men-generate kode barcode aset unik untuk setiap eksemplar fisik dan menyimpannya di cabang aktif dengan status awal `in_stock`.

---

## 4. Modul Branch Stock Inventory (Inventaris Cabang)
Modul ini menampilkan seluruh unit fisik buku yang saat ini berada di cabang aktif.

### 4.1 Filter Kondisi & Pencarian Barcode
- **Search input**: Cari cepat unit buku berdasarkan nomor barcode atau judul buku.
- **Dropdown Kondisi (*All Conditions*)**:
  - `All Conditions`: Menampilkan semua unit buku.
  - `New`: Buku baru.
  - `Good`: Buku kondisi bagus/siap pakai.
  - `Fair`: Buku dengan bekas pemakaian wajar.
  - `Damaged`: Buku rusak / perlu disortir / retur.

### 4.2 Mengaudit / Mengubah Kondisi Fisik Buku
- Staf perpustakaan dapat mengubah status kondisi buku kapan saja melalui dropdown di kolom **Audit Condition** pada baris yang bersangkutan.

### 4.3 Melakukan Retur / Quick Transfer Massal
Skenario ideal: Cabang ingin menyortir semua buku rusak dan langsung meretur ke pusat atau memindahkan ke cabang lain:
1. Pilih filter kondisi **`Damaged`** pada dropdown kondisi.
2. Centang checkbox pada buku-buku yang ingin dikirim (atau gunakan checkbox di header tabel untuk memilih semua sekaligus).
3. Bar aksi mengambang (*floating action bar*) berwarna gelap akan muncul di atas tabel, menunjukkan jumlah buku yang dipilih.
4. Klik tombol **`Transfer / Retur Buku`**.
5. Modal **Buat Pengiriman Transfer / Retur** akan terbuka:
   - **Sekolah / Cabang Tujuan**: Pilih tujuan (misal: Kantor Pusat / HQ untuk retur, atau cabang lain).
   - **Alasan / Keterangan Transfer**: Terisi otomatis *"Retur buku rusak"* jika semua buku yang dipilih berstatus damaged, atau Anda dapat mengganti keterangan sesuai kebutuhan.
   - **Catatan Tambahan**: Masukkan catatan ekspedisi jika diperlukan.
   - **Daftar Buku Terpilih**: Tinjau kembali barcode, judul, dan flag kondisi fisik buku yang akan dikirim.
6. Klik **`Buat Draf Transfer`**.
7. Sistem otomatis membuat dokumen transfer pengiriman draf dan Anda akan melihat notifikasi nomor transfer (misal: `TRF-123456`).

---

## 5. Modul Inter-School Stock Transfers (Logistik Pengiriman)
Modul ini memantau seluruh proses mutasi pengiriman buku antar sekolah.

### 5.1 Siklus Status Transfer
Sebuah transfer shipment melewati tahapan resmi berikut:
1. **`draft`**: Dokumen transfer baru dibuat. Buku masih berada di stok asal.
2. **`in_transit`**: Dokumen telah diberangkatkan (*Dispatch*). Status buku fisik otomatis terkunci menjadi `in_transit` (tidak dapat dipinjam/dipindahkan).
3. **`completed`**: Dokumen telah diterima oleh cabang tujuan (*Receive*). Kepemilikan fisik buku otomatis beralih ke cabang tujuan dengan status `in_stock`.
4. **`completed_with_discrepancy`**: Dokumen diterima namun ada barang yang rusak dalam perjalanan atau hilang (*missing*).

### 5.2 Memberangkatkan Pengiriman (*Dispatch Shipment*)
1. Buka tab **Interschool Transfers**.
2. Klik kartu transfer yang berstatus `draft`.
3. Modal detail manifes pengiriman akan terbuka, menampilkan:
   - Asal & Tujuan sekolah.
   - Alasan transfer (`reason`).
   - Daftar item manifes beserta flag kondisi fisik awalnya.
4. Klik tombol **`Dispatch Shipment`**.
5. Status transfer berubah menjadi `in_transit`.

### 5.3 Menerima Pengiriman (*Receive Shipment*)
1. Staf cabang tujuan membuka tab **Interschool Transfers**.
2. Klik kartu transfer yang berstatus `in_transit`.
3. Verifikasi fisik buku yang tiba dengan manifes.
4. Klik tombol **`Receive Shipment`**.
5. Sistem menyelesaikan mutasi:
   - Unit buku otomatis masuk ke inventaris cabang penerima.
   - Status diperbarui menjadi `completed`.

---

## 6. Pertanyaan Umum & Bantuan (FAQ)
- **Q: Apakah admin cabang bisa mengirim buku yang sedang dipinjam atau sedang di jalan?**  
  *A: Tidak. Sistem hanya mengizinkan seleksi dan mutasi untuk unit buku yang berstatus `in_stock`.*
- **Q: Bagaimana jika buku mengalami kerusakan saat di perjalanan?**  
  *A: Staf penerima dapat mencatat kondisi saat penerimaan, sehingga sistem mencatat status discrepancy dan riwayat kerusakan secara transparan.*
