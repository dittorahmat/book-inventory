# Panduan Skenario Demo Operasional Sistem Inventaris Buku

Panduan ini berisi langkah-langkah terperinci untuk menjalankan simulasi demo bisnis proses menyeluruh (end-to-end) di aplikasi **School Book Inventory & Logistics System (Al Wildan Islamic School)**.

---

## 👥 Akun Kredensial Demo

| Peran (Role) | Email | Password | Unit / Kampus | Hak Akses |
|---|---|---|---|---|
| **Central Admin (HQ Pusat)** | `admin.pusat@alwildan.sch.id` | `password123` | Al Wildan 1 (Pusat) | Seluruh menu: Semua Cabang, Bundling, Approval Beasiswa, Handover Surat Jalan, PO Supplier, Approval Retur, Pengaturan SMTP |
| **Branch Admin 2** | `admin.cabang2@alwildan.sch.id` | `password123` | Al Wildan 2 | Menu terisolasi untuk Al Wildan 2 (Pesanan Siswa, Stok Cabang, Penerimaan Surat Jalan) |
| **Branch Admin 3** | `admin.cabang3@alwildan.sch.id` | `password123` | Al Wildan 3 | Menu terisolasi untuk Al Wildan 3 |
| **Branch Admin 4** | `admin.cabang4@alwildan.sch.id` | `password123` | Al Wildan 4 | Menu terisolasi untuk Al Wildan 4 |

> 💡 **Akses Cepat**: Di halaman Login Staf, terdapat kotak **"Akses Demo Cepat"** dengan tombol 1-klik untuk masuk tanpa mengetik email/password.

---

## 🎯 7 Skenario Simulasi Demo

```
                                 ALUR SIMULASI DEMO
                                 
  [PORTAL ORANG TUA / PUBLIK]                   [DASHBOARD STAF LOGISTIK]
  ┌─────────────────────────┐                   ┌─────────────────────────┐
  │ 1. Pemesanan Mandiri    │ ──(Submit Order)─>│ 3. Verifikasi Kasir     │
  │    - Siswa Lama/Naik    │                   │    - Cicilan / Parsial  │
  │    - Murid Baru         │                   │    - Beasiswa 100%      │
  │    - Beasiswa 100%      │                   ├─────────────────────────┤
  ├─────────────────────────┤                   │ 4. Bundling & Assembly  │
  │ 2. Lapor Retur Buku     │                   │    Stok Satuan -> Paket │
  │    - Input No. Pesanan  │                   ├─────────────────────────┤
  │    - Pilih Buku Cacat   │ ──(Submit Retur)─>│ 5. Handover Surat Jalan │
  │    - Upload Foto Bukti  │                   ├─────────────────────────┤
  └─────────────────────────┘                   │ 6. Tukar Fisik Retur    │
                                                ├─────────────────────────┤
                                                │ 7. Pengadaan PO Vendor  │
                                                └─────────────────────────┘
```

---

### Skenario 1: Portal Orang Tua — Pemesanan Murid Naik Kelas & Pembayaran Cicilan

1. Buka halaman utama aplikasi (Portal Publik).
2. Di formulir pencarian murid:
   - Ketik nama: `Hendra` atau `Wahyudi` (atau NIS `2024101001`).
   - Klik **Cari Data**.
   - Sistem mendeteksi otomatis: **Hendra Wahyudi &bull; Naik ke Kelas 2**.
3. Klik tombol **Pilih**:
   - Sistem otomatis memilih **Paket Kelas 2 SD Internasional (Cambridge)** seharga **Rp 1.950.000**.
4. Klik **Lanjut ke Pembayaran**:
   - Pilih tab **Jalur Reguler**.
   - Pilih opsi pembayaran: **Cicilan (Parsial)**.
   - Masukkan *Total Nominal Struk Bukti Transfer*: `Rp 3.500.000` *(simulasi transfer gabungan SPP + Uang Buku)*.
   - Masukkan *Alokasi Khusus Buku Ini*: `Rp 1.000.000` *(Sisa tagihan Rp 950.000)*.
   - Pilih Bank: `BCA`, masukkan nomor resi `TRX-BCA-99281`.
   - Unggah foto struk transfer.
5. Klik **Konfirmasi & Kirim Pesanan**:
   - Sistem menampilkan halaman sukses dengan **Nomor Pesanan** (contoh: `ORD-xxxxxx`).

---

### Skenario 2: Portal Orang Tua — Pendaftaran Murid Baru & Beasiswa 100%

1. Di Portal Publik (Tab *Formulir Pesan Buku*):
   - Ketik nama yang belum ada, misal: `Zaidan Faris`.
   - Klik **Cari Data** &rarr; sistem memunculkan kotak **"Daftar Murid Baru"**.
2. Klik tombol **Daftar Murid Baru**:
   - Pilih Cabang: `Al Wildan 1 (Islamic School Pusat)`.
   - Nama Lengkap: `Zaidan Faris`.
   - Kelas: `Kelas 1 SD`.
   - Kurikulum: `Internasional (Cambridge)`.
   - Nama Orang Tua: `Faris Abdullah`, Email: `faris@example.com`, No. WA: `081234567890`.
   - Klik **Lanjutkan Pilih Paket**.
3. Pilih **Paket Kelas 1 SD Internasional (Cambridge + Diniyyah)** (Normal: Rp 1.850.000).
4. Klik **Lanjut ke Pembayaran**:
   - Pilih opsi: **Jalur Beasiswa (Diskon 100%)**.
   - Total tagihan menjadi **Rp 0**.
   - Unggah foto dokumen **Surat Keterangan / Tanda Beasiswa Tahfidz**.
5. Klik **Konfirmasi & Kirim Pesanan**:
   - Pesanan dibuat dengan status `scholarship_pending` (menunggu verifikasi loket administrasi).

---

### Skenario 3: Dashboard Staf — Verifikasi Kasir & Approval Beasiswa

1. Di pojok kanan atas Portal Publik, klik tombol **"Login Staf / Admin &rarr;"**.
2. Masuk menggunakan akun **Central Admin (HQ Pusat)** (`admin.pusat@alwildan.sch.id`).
3. Masuk ke tab **Pesanan Siswa**:
   - Lihat daftar pesanan. Anda akan melihat pesanan **Muhammad Farhan Al-Ghifari** atau **Zaidan Faris** dengan status beasiswa.
   - Klik tombol **Lihat Dokumen Beasiswa** untuk memeriksa foto surat rekomendasi beasiswa.
   - Klik tombol **Setujui Beasiswa (100% Bebas Biaya)** &rarr; status otomatis berubah menjadi `scholarship_approved`.
4. Untuk pesanan berstatus `partial` (Nathaniel Arya / Hendra):
   - Klik tombol **Catat Pembayaran**:
   - Lihat rincian alokasi: berapa yang dibayarkan khusus buku dan berapa sisa tagihan.
   - Input sisa pembayaran pelunasan jika orang tua sudah melunasi cicilan ke-2.

---

### Skenario 4: Gudang Logistik — Perakitan Bundling Paket Buku

*Bisnis proses: Buku dikirim supplier secara lepasan/satuan. Tim logistik sekolah menggabungkannya menjadi paket bundel rapi sebelum diserahkan ke murid.*

1. Masuk ke tab **Paket & Bundling**:
   - Anda melihat kartu **Paket Kelas 1 SD Internasional (Cambridge + Diniyyah)** yang terdiri dari 8 judul buku.
   - Di kartu paket, terlihat indikator stok:
     - **Stok Paket Jadi (Ready Bundles)**: misal 15 paket.
     - **Komponen Satuan Tersedia**: memperlihatkan stok tiap buku lepasan.
     - **Potensi Bundling Maksimal**: sistem otomatis menghitung berapa paket yang bisa dirakit berdasarkan stok buku terkecil.
2. Klik tombol **Rakit Bundling (Satuan &rarr; Paket)**:
   - Masukkan jumlah yang ingin dirakit, misal `5 paket`.
   - Klik **Konfirmasi Bundling**.
   - **Hasil**: 5 x 8 = 40 buku satuan otomatis dikurangi dari gudang lepas, dan 5 unit paket baru bertambah ke stok bundle siap serah.
3. Fitur **Bongkar Bundling (Unbundle)**:
   - Jika sewaktu-waktu stok satuan di perpustakaan habis, klik tombol **Bongkar Paket**. Masukkan alasan (misal: "Kebutuhan penggantian buku rusak"), paket akan terurai kembali menjadi stok satuan.

---

### Skenario 5: Penyerahan Buku ke Orang Tua & Cetak Surat Jalan Penyerahan

1. Di tab **Pesanan Siswa**:
   - Cari pesanan yang sudah lunas atau beasiswa disetujui (misal: **Aisyah Nur Salsabila**).
   - Pastikan status pemenuhan fisik masih `waiting_preparation`.
2. Klik tombol **Serahkan Buku (Handover)**:
   - Masukkan Nama Pengambil / Wali: `Ir. Bambang Trihatmojo (Ayah)`.
   - Pilih kode barcode paket yang diserahkan dari rak logistik.
   - Klik **Konfirmasi Penyerahan**.
3. **Hasil**:
   - Status berubah menjadi `picked_up`.
   - Sistem secara otomatis menerbitkan **Nomor Surat Jalan Penyerahan** resmi (format: `SJ-SERAH-xxxxxx`) dan mencatat tanggal/waktu serah terima.

---

### Skenario 6: Layanan Komplain & Retur Buku Cacat Fisik

*Skenario: Orang tua murid yang sudah mengambil buku menemukan halaman sobek atau cetakan rusak di rumah.*

#### A. Sisi Orang Tua (Portal Publik)
1. Di header staf, klik tombol **"Portal Ortu"** (atau buka portal publik).
2. Pilih tab **"Lapor Retur Buku Rusak"**:
   - Masukkan Nomor Pesanan Aisyah: `ORD-202609-001` (atau NIS `2024101002`).
   - Klik **Temukan Pesanan**.
3. Pilih pesanan yang muncul:
   - Pilih judul buku yang cacat: *Cambridge Primary Mathematics Learner's Book 1*.
   - Deskripsi Kerusakan: `Halaman 20 sampai 35 robek dan cetakan matematika buram tidak terbaca`.
   - Unggah foto bukti fisik halaman buku yang sobek.
   - Klik **Kirim Pengaduan Retur**.

#### B. Sisi Staf Logistik (Dashboard Internal)
1. Kembali ke Dashboard Staf, buka tab **Retur Buku**:
   - Muncul antrean komplain buku cacat dari Aisyah dengan badge kuning `reported`.
   - Klik tombol **Tinjau Laporan & Foto**:
     - Staf memeriksa foto bukti kerusakan yang dikirimkan orang tua.
   - Klik **Ganti Buku (Tukar dari Stok Satuan)**:
     - Sistem otomatis mencari buku satuan baru yang berkondisi `new` di gudang cabang, menggantikan buku lama, dan mengubah status laporan menjadi `replaced` (hijau).

---

### Skenario 7: Pengadaan Purchase Order (PO) ke Supplier / Penerbit

1. Buka tab **Pengadaan PO**:
   - Terlihat data supplier resmi (PT Penerbit Erlangga & PT Mentari Books Utama - Cambridge Official).
   - Terlihat draf PO `PO-202609-0088` berstatus `partially_received`.
2. Klik tombol **Buat Purchase Order Baru**:
   - Pilih Supplier: `PT Mentari Books Utama`.
   - Target Gudang Sekolah: `Al Wildan 1 (Islamic School Pusat)`.
   - Pilih buku yang dipesan dan masukkan kuantitas.
   - Masukkan estimasi tanggal tiba.
   - Simpan PO.
3. Saat kiriman kardus buku dari vendor tiba di sekolah:
   - Klik **Terima Barang Inbound**:
   - Masukkan kuantitas buku fisik yang diterima secara bertahap.
   - Stok satuan (`book_items`) otomatis ter-generate dengan barcode baru di gudang.

---

## ⚙️ Pengaturan Notifikasi Email & SMTP

Di menu **Pengaturan** (khusus Central Admin):
- Tersedia konfigurasi **SMTP Server**:
  - SMTP Host (default: `smtp.gmail.com`)
  - SMTP Port (`587` / `465`)
  - Username & App Password
  - Sender Email & Nama Pengirim
- Setiap kali pemesanan buku disetujui atau buku diserahkan, notifikasi otomatis terkirim ke email orang tua murid (`parentEmail`).
