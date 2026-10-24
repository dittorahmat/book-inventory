# Studi Kasus Demo End-to-End — Al Wildan 2026/2027

Dokumen ini adalah naskah demo tunggal untuk seluruh modul **School Book Inventory & Logistics System**. Satu cerita: **Pekan Distribusi Buku & Seragam Tahun Ajaran 2026/2027** di empat kampus Al Wildan dan satu gudang pusat.

Setiap bab bisa dijalankan apa adanya setelah data demo di-seed. Angka, nomor dokumen, dan status yang ditulis di sini adalah angka yang benar-benar ada di database demo — bukan contoh karangan.

---

## 1. Cara memakai dokumen

- **Bagian portal publik (Bab 6–14)** bisa dijalankan tanpa login, dari browser orang tua.
- **Bagian staf** memakai akun pada tabel §3; semua aksi staf ada di dashboard internal.
- Jalankan berurutan bila ingin cerita utuh; setiap bab juga bisa berdiri sendiri.
- Istilah domain mengikuti `GLOSSARY.md` (Struk Bayar, Alokasi, Tagihan Cabang, Klaim Cabang, Ambil Langsung, Kirim-Rumah, Rakit Bundling, WPR, dll).

---

## 2. Prasyarat dan reset data

```bash
bun install
bun run db:push          # sinkronkan skema SQLite lokal
bun run dev              # API :3000 + Vite :5173
```

1. Buka aplikasi, login `admin.gudang@alwildan.sch.id` / `password123`.
2. Jika database masih kosong, aplikasi menawarkan seed otomatis. Untuk memaksa ulang:
   ```bash
   curl -X POST http://localhost:3000/api/demo/seed -H "Authorization: Bearer <token>"
   ```
   atau gunakan tombol seed di layar login staf.
3. Seed bersifat **idempoten**: baris demo di-upsert, bukan dihapus. Menjalankan ulang mengembalikan status demo (mis. Zaidan kembali `new_pending`, struk pending kembali belum diverifikasi).
4. Untuk D1/Cloudflare, jangan memanggil endpoint seed berulang dari Worker. Ekspor ke SQL lalu terapkan:
   ```bash
   bun run db:d1:seed:export
   bun run db:d1:seed
   ```

Catatan perilaku yang wajib diketahui operator:

- Semua harga paket = jumlah harga jual komponen + **WPR Rp 750.000**.
- Pesanan satuan hanya muncul bila cut-off satuan terbuka. Seed membuka `2026/2027` sejak `2026-07-01`.
- Seragam satuan aktif (`uniform_satuan_enabled = true`), tetapi murid yang belum pernah memesan seragam **wajib** memesan paket lebih dulu.
- Bukti dokumen demo berupa data URL, jadi selalu bisa dibuka tanpa storage eksternal.

---

## 3. Akun demo

| Peran | Email | Password | Lokasi | Tab yang terlihat |
|---|---|---|---|---|
| Central Admin | `admin.gudang@alwildan.sch.id` | `password123` | Gudang Logistik | Semua tab + Pengaturan |
| Admin Logistik | `admin.logistik@alwildan.sch.id` | `password123` | Gudang Logistik | Dashboard, buku, seragam, logistik (tanpa Pengaturan) |
| Admin Gudang Buku | `admin.buku@alwildan.sch.id` | `password123` | Gudang Logistik | Tab buku + logistik |
| Admin Gudang Seragam | `admin.seragam@alwildan.sch.id` | `password123` | Gudang Logistik | Gudang Seragam |
| School Admin 1 | `admin.pusat@alwildan.sch.id` | `password123` | Al Wildan 1 | Pesanan, siswa, pesan ke gudang |
| Branch Admin 2 | `admin.cabang2@alwildan.sch.id` | `password123` | Al Wildan 2 | Idem, terkunci kampus 2 |
| Branch Admin 3 | `admin.cabang3@alwildan.sch.id` | `password123` | Al Wildan 3 | Idem, terkunci kampus 3 |
| Branch Admin 4 | `admin.cabang4@alwildan.sch.id` | `password123` | Al Wildan 4 | Idem, terkunci kampus 4 |

Layar login staf punya **Akses Demo Cepat** untuk kedelapan akun.

---

## 4. Cast siswa dan angka kunci

### 4.1 Siswa

| Siswa | NIS | Kampus | Kelas | Kurikulum | Status | Peran dalam demo |
|---|---|---|---|---|---|---|
| Aisyah Nur Salsabila | 2024101002 | Al Wildan 1 | 1 | Internasional | aktif | Order lunas + sudah ambil; bahan refund buku |
| Nathaniel Arya | 2024101004 | Al Wildan 1 | 1 | Nasional | aktif | Cicilan + struk pending Rp 490.000 |
| Muhammad Farhan Al-Ghifari | 2024101003 | Al Wildan 1 | 1 | Internasional | aktif | Beasiswa 100% menunggu persetujuan |
| Hendra Wahyudi | 2024101001 | Al Wildan 1 | 1 | Internasional | **naik kelas** | Paket Kelas 2 Internasional belum dibayar |
| Kayla Putri Ramadhani | 2024101005 | Al Wildan 1 | 2 | Internasional | aktif | Order lunas menunggu serah-terima |
| Salsabila Zahra | 2024101007 | Al Wildan 1 | 2 | Nasional | aktif | Order satuan + WPR Rp 1.000.000 |
| Raka Pradipta | 2024101008 | Al Wildan 1 | 2 | Internasional | **naik kelas** | Empty state paket Kelas 3 |
| Zaidan Faris | `REG-DEMO-ZAIDAN` | Al Wildan 1 | 1 | Internasional | **murid baru** | Antrean verifikasi NIS |
| Rania Putri | 2026202001 | Al Wildan 2 | 2 | Internasional | aktif | Order lunas + sudah ambil |
| Naura Zahira | 2026203001 | Al Wildan 3 | 1 | Internasional | aktif | Order cicilan Rp 700.000 |
| Rizky Pratama | 2026204001 | Al Wildan 4 | 2 | Nasional | aktif | Order belum bayar |

### 4.2 Harga paket

| Paket | Komponen | WPR | Harga |
|---|---|---|---|
| Kelas 1 SD Internasional (`PKG-SD1-INT`) | Rp 670.000 | Rp 750.000 | **Rp 1.420.000** |
| Kelas 1 SD Nasional (`PKG-SD1-NAS`) | Rp 240.000 | Rp 750.000 | **Rp 990.000** |
| Kelas 2 SD Internasional (`PKG-SD2-INT`) | Rp 600.000 | Rp 750.000 | **Rp 1.350.000** |
| Kelas 2 SD Nasional (`PKG-SD2-NAS`) | Rp 240.000 | Rp 750.000 | **Rp 990.000** |

### 4.3 Dokumen kunci

| Dokumen | Nomor | Isi |
|---|---|---|
| Order buku lunas | `ORD-202609-001` | Aisyah, Rp 1.420.000, sudah diambil, `SJ-SERAH-202609-0012` |
| Order cicilan | `ORD-202609-002` | Nathaniel, Rp 990.000, dibayar Rp 500.000 |
| Order beasiswa | `ORD-202609-003` | Farhan, total Rp 0, `scholarship_pending` |
| Order belum bayar | `ORD-202609-004` | Hendra, Rp 1.350.000 |
| Order lunas menunggu serah | `ORD-202610-101` | Kayla, Rp 1.350.000 |
| Order satuan + WPR | `ORD-202610-102` | Salsabila, Rp 1.000.000 (Rp 130.000 + Rp 120.000 + WPR) |
| Order cabang | `ORD-202610-201/202/203` | Lunas, cicilan, belum bayar |
| Penjualan langsung | `DIR-202610-001` | Rp 250.000, tunai gudang |
| Token bayar buku | `demo-token-buku-nathan` | Sisa Rp 990.000 + ongkir Rp 25.000 |
| Token bayar satuan | `demo-token-buku-satuan` | Rp 1.000.000 + ongkir Rp 25.000 |
| Token bayar seragam | `demo-token-seragam-01` / `-03` | Rp 230.000 + ongkir 15.000 / 18.000 |
| Struk pending | `BCA-NTH-0002` / `MND-SRG-0002` | Rp 490.000 / Rp 230.000 |
| Retur buku | `ret-demo-1` | Aisyah, Cambridge Mathematics 1, `reported` |
| Order seragam | `USO-DEMO-01..05` | partial / paid / unpaid / unpaid / paid cabang 2 |
| PO seragam | `UPO-DEMO-2026-02` | diterima sebagian |
| IPO | `IPO-202610-0001/0002` | submitted / partial_fulfilled |
| Surat jalan internal | `SJ-INT-202610-0001..0004`, `SJ-PUSH-202610-0001` | transit / diterima / diterima 10 bundel / selisih / push |
| Transfer | `TRF-202610-0001..0003` | draft / transit / selesai |
| Retur vendor | `RTV-202610-0001` | selesai, credit note Rp 285.000 |
| Tagihan cabang | `TGH-DEMO-0001..0006` | lima final, satu open |
| Klaim cabang | `CLM-DEMO-<periode>` / `CLM-DEMO2-<periode>` | draft Rp 1.920.000 / locked Rp 1.638.000 |
| Berita Acara | `BA-RECON-DEMO-0001` | 10 masuk, 1 tersalur, 9 sisa sistem, 7 fisik, 2 selisih |

---

## 5. Peta modul → skenario

| Modul / tab | Skenario |
|---|---|
| Portal: Konfirmasi Pembayaran Buku | 1, 2, 3, 4, 5 |
| Portal: Refund Buku | 9 |
| `/bayar/buku/:token`, `/bayar/seragam/:token` | 7 |
| Pesanan Siswa | 6, 7, 8, 9 |
| Data Siswa | 3 |
| Katalog | 10 |
| Paket & Rakit | 10 |
| Stok Satuan | 11 |
| PO Supplier | 12 |
| Refund Buku (staf) | 9 |
| Pesan ke Gudang / Pesanan dari Cabang | 13 |
| Gudang Seragam | 14 |
| Portal: Pesan Seragam & Retur Seragam | 15 |
| Rekonsiliasi | 16, 17 |
| Laporan | 18 |
| Dashboard | 18 |
| Pengaturan | 19 |
| Isolasi peran (semua akun) | 20 |
| API-only: transfer dispatch/receive, retur vendor | 11, 12 |

---

## 6. Skenario 1 — Paket terkunci, kenaikan kelas, dan empty state

**Tujuan:** membuktikan portal tidak membiarkan orang tua memilih paket manual; paket mengikuti kelas + kurikulum.

1. Buka `/` (tab **Konfirmasi Pembayaran Buku**).
2. Pilih sekolah **Al Wildan 1**, ketik `Hendra`, klik **Cari Data**.
   - Hasil: **Hendra Wahyudi · NIS 2024101001 · Kelas 1 → naik ke Kelas 2 · Internasional**.
3. Klik **Pilih**.
   - Terkunci **Paket Kelas 2 SD Internasional** seharga **Rp 1.350.000**; tidak ada daftar paket lain.
   - Rincian 8 buku tampil.
4. Klik **Ubah Murid**, ulangi untuk:
   - `Bimo` → terkunci Paket Kelas 2 Nasional **Rp 990.000**.
   - `Kayla` → terkunci Paket Kelas 2 Internasional **Rp 1.350.000**.
   - `Salsabila` → terkunci Paket Kelas 2 Nasional **Rp 990.000**.
5. Demo empty state: cari `Raka` → **Kelas 2 → naik ke Kelas 3 · Internasional**.
   - Klik **Pilih** → layar **“Paket tidak ditemukan”**, tombol lanjut nonaktif, hanya ada **Ubah Murid**.

**Verifikasi:** harga di kartu paket sama dengan harga master; tidak ada tombol pilih paket lain.

---

## 7. Skenario 2 — Order satuan + WPR

**Tujuan:** membuktikan cut-off satuan, katalog satuan dengan judul publik, dan biaya WPR wajib.

1. Di portal, cari `Bimo` → **Pilih**.
2. Aktifkan mode **Satuan** (muncul karena cut-off `2026/2027` terbuka).
3. Pilih:
   - Cambridge Global English 1 ×1 → Rp 130.000
   - Cambridge Primary Mathematics 1 ×1 → Rp 120.000
4. Pertanyaan WPR muncul: Bimo **belum punya order paket**, jadi WPR **Rp 750.000** ikut ditagihkan.
   - Total menjadi **Rp 1.000.000**.
5. Klik **Lanjut ke Pembayaran** → isi alamat rumah lengkap (harus ada RT, RW, dan kode pos 5 digit).
6. Unggah bukti transfer dan isi nomor WhatsApp aktif, lalu **Konfirmasi & Kirim Pesanan**.
   - Order baru muncul dengan total **Rp 1.000.000**, status bayar `unpaid`, status kirim satuan `belum_dikirim`.

**Verifikasi:** rincian order memuat 2 buku + baris **Weekly Progress Report**; tanpa alamat valid server menolak submit.

> Pembanding siap pakai: `ORD-202610-102` (Salsabila) sudah berisi 2 buku + WPR dengan total sama.

---

## 8. Skenario 3 — Pendaftaran murid baru dan verifikasi NIS

**Tujuan:** membuktikan murid baru tidak bisa langsung memesan sebelum admin memberi NIS.

1. Portal, cari `Zaidan Faris` → tidak ada hasil → klik **Daftar Murid Baru**.
2. Isi: Al Wildan 1, Kelas 1 SD, Internasional, orang tua **Faris Abdullah**, email `faris@example.com`, WA `081234567890`.
3. Submit → layar **“Pendaftaran Diterima — menunggu verifikasi admin sekolah”**; pemesanan terkunci.
4. Login `admin.pusat@alwildan.sch.id` → tab **Data Siswa**.
   - Antrean verifikasi menampilkan **Zaidan Faris** dengan NIS sementara `REG-DEMO-ZAIDAN`.
5. Isi NIS resmi `20260015` → **Setujui**.
6. Kembali ke portal, cari `Zaidan` → sudah muncul dan bisa memilih paket **Kelas 1 SD Internasional Rp 1.420.000**.

**Verifikasi:** sebelum disetujui, pencarian portal tidak menampilkan Zaidan; sesudahnya status berubah `active`.

---

## 9. Skenario 4 — Beasiswa 100%

**Tujuan:** membuktikan jalur beasiswa memerlukan bukti dan persetujuan staf.

1. Portal, cari `Zaidan` (setelah Bab 8) → **Pilih** → paket Kelas 1 Internasional.
2. Di langkah pembayaran pilih **Jalur Beasiswa (Diskon 100%)**.
   - Total tagihan menjadi **Rp 0**.
3. Unggah foto surat beasiswa (format gambar) → **Konfirmasi & Kirim Pesanan**.
   - Status order `scholarship_pending`.
4. Login staf → **Pesanan Siswa** → cari Zaidan → **Lihat Dokumen Beasiswa** → **Setujui Beasiswa**.
   - Status menjadi `scholarship_approved`, total tetap Rp 0.
5. Jalur cepat: order **Farhan** (`ORD-202609-003`) sudah `scholarship_pending` dengan bukti yang bisa langsung dibuka.

**Verifikasi:** bukti terbuka sebagai gambar; tombol setuju hanya muncul untuk beasiswa.

---

## 10. Skenario 5 — Bukti transfer portal menjadi struk pending

**Tujuan:** membuktikan klaim orang tua tidak langsung melunasi order; staf tetap verifikator.

1. Buka `http://localhost:5173/bayar/buku/demo-token-buku-nathan`.
   - Tampil: Nathaniel, total Rp 990.000, ongkir Rp 25.000, **sisa Rp 1.015.000**.
2. Isi transfer **Rp 490.000**, alokasi buku **Rp 490.000**, bank **BCA**, referensi `BCA-NTH-0002`, unggah bukti → submit.
   - Muncul pesan **“Konfirmasi tercatat. Status akan diverifikasi admin.”**
3. Ulangi pola yang sama untuk:
   - `demo-token-buku-satuan` → sisa Rp 1.025.000.
   - `demo-token-seragam-01` → sisa Rp 245.000.
   - `demo-token-seragam-03` → sisa Rp 248.000.
4. Coba kirim alokasi melebihi sisa tagihan → server menolak `Nominal alokasi melebihi total tagihan order`.
5. Coba bank + nomor referensi yang sama dua kali → `409 Bukti transfer ... sudah pernah dicatat`.

**Verifikasi:** order **belum** berubah status setelah klaim; struk berstatus pending.

---

## 11. Skenario 6 — Verifikasi bukti, kasir, dan diskresi finance

**Tujuan:** membuktikan status pembayaran hanya berubah lewat aksi staf.

1. Login `admin.pusat@alwildan.sch.id` → **Pesanan Siswa**.
2. Pada **Nathaniel** (`ORD-202609-002`) klik **Verifikasi Bukti**:
   - struk `BCA-NTH-0002` Rp 490.000 pending → **Verifikasi**.
   - Total terverifikasi menjadi Rp 500.000 + Rp 490.000 = **Rp 990.000** → order **lunas**.
3. Demo tolak: pada order seragam **USO-DEMO-03** buka verifikasi struk `MND-SRG-0002` → **Tolak** dengan alasan.
   - Sistem mengirim ulang tautan bayar yang sama; orang tua bisa unggah ulang.
4. Demo kasir: pada **Hendra** (`ORD-202609-004`, Rp 1.350.000) klik **Catat Pembayaran**:
   - total transfer Rp 1.350.000, alokasi buku Rp 1.350.000, bank BCA, referensi baru → order lunas.
5. Demo diskresi: pada order lain klik **Diskresi Finance** → pilih `discount`, isi nominal + catatan wajib → total tagihan turun.
6. Demo beasiswa pada Bab 9 bila belum.

**Verifikasi:** badge pembayaran berubah `partial` → `paid`; struk yang ditolak tidak menambah `paidAmount`.

---

## 12. Skenario 7 — Invoice, ongkir, dan halaman bayar

**Tujuan:** membuktikan invoice hanya terkirim setelah ongkir/resi (untuk satuan/seragam) dan tautan bayar bekerja.

1. Di **Pesanan Siswa**, pilih order satuan Salsabila (`ORD-202610-102`).
   - Sudah ada ongkir Rp 25.000 + resi `JNE-BKU-0002` dan `invoiceSentAt`.
2. Ganti ongkir lewat **Input Ongkir** bila perlu; tombol **Kirim Ulang Invoice** aktif hanya saat ongkir/resi terisi.
3. Buka tautan bayar:
   - `demo-token-buku-nathan` (Bab 10) → kirim Rp 490.000 → verifikasi (Bab 11) → lunas.
   - `demo-token-buku-satuan` → kirim termin bebas, mis. Rp 500.000.
4. Untuk seragam: buka **Gudang Seragam → Pengiriman**, order `USO-DEMO-01`.
   - Ongkir Rp 15.000, resi `JNE-SRG-0001`; kirim invoice; buka `demo-token-seragam-01`.
5. `USO-DEMO-03` sudah punya struk pending Rp 230.000; verifikasi → order seragam **lunas**.

**Verifikasi:** token tidak valid → `404 Link konfirmasi tidak valid`; order lunas menolak klaim baru.

---

## 13. Skenario 8 — Serah terima buku dan Surat Jalan

**Tujuan:** membuktikan serah-terima membuat nomor `SJ-SERAH-*` dan mengikat bundel fisik.

1. Login `admin.pusat@alwildan.sch.id` → **Pesanan Siswa**.
2. Cari **Kayla** (`ORD-202610-101`, lunas, `waiting_preparation`).
3. Klik **Serahkan Buku**:
   - Nama pengambil: `Hj. Ramadhani (Ibu)`.
   - Konfirmasi.
4. Hasil:
   - Status pemenuhan menjadi `picked_up`.
   - Nomor surat jalan `SJ-SERAH-*` terbit.
   - Siswa ditandai sudah menerima paket; satu bundel berstatus terkirim.
5. Cetak **Surat Jalan Serah-Terima** dari modal.
6. Pembanding: Aisyah sudah `picked_up` dengan `SJ-SERAH-202609-0012` dan bundel `PKG-ALW1-2026-0001`.

**Verifikasi:** stok siap paket berkurang satu; serah-terima tidak bisa memakai bundel paket yang salah.

---

## 14. Skenario 9 — Refund buku: lapor, ganti, tolak, refund

**Tujuan:** membuktikan alur komplain fisik dari orang tua sampai keputusan logistik.

### 14.1 Lapor dari portal

1. Buka `/refund` (tab **Refund Buku**), pilih Al Wildan 1.
2. Cari `ORD-202609-001` (Aisyah) → pilih order berstatus **Sudah diserahkan**.
3. Pilih buku **Cambridge Primary Science Learner's Book 1** (jangan Mathematics: `b-math-1` sudah dilaporkan di `ret-demo-1`).
4. Isi alasan ≥5 karakter, unggah foto kondisi buku (JPEG/PNG/WebP ≤2 MB) → **Kirim Pengaduan Refund**.
   - Order berubah `return_in_progress`.
5. Lapor buku yang sama dua kali → ditolak `Buku ini sudah dilaporkan`.

### 14.2 Putuskan dari staf

1. Login gudang → tab **Refund Buku**.
2. `ret-demo-1` (Aisyah, `b-math-1`) berstatus **Menunggu Periksa** → **Tinjau Laporan & Foto** (bukti data URL terbuka).
3. Pilih **Ganti Buku** → sistem memilih eksemplar `new` di kampus yang sama; status menjadi **Sudah Diganti**.
4. Pada laporan kedua (Bab 14.1), pilih **Refund Dana** dan isi nominal, atau **Tolak**.
5. Selesai: order kembali `picked_up` bila tidak ada laporan terbuka lain.

**Verifikasi:** eksemplar pengganti berstatus disposed; refund menambah satu eksemplar `RFD-*` ke stok; laporan selesai tidak bisa diputuskan dua kali dengan aksi berbeda.

---

---

> Bab staf lanjutan (katalog, rakit, stok, PO, IPO, seragam, rekonsiliasi, audit periode, laporan, pengaturan, isolasi peran) ditulis pada bagian kedua dokumen ini.
