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
| Alya Safira | 2026203003 | Al Wildan 3 | 1 | Nasional | **naik kelas** | Portal menawarkan paket Kelas 2 |
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
| Token bayar buku | `demo-token-buku-nathan` | Total Rp 990.000 (paket diambil di sekolah, tanpa ongkir) |
| Token bayar satuan | `demo-token-buku-satuan` | Rp 1.000.000 + ongkir Rp 25.000 |
| Token bayar seragam | `demo-token-seragam-01` / `-03` | Rp 230.000 + ongkir 15.000 / 18.000 |
| Struk pending | `BCA-NTH-0002` / `MND-SRG-0002` | Rp 490.000 / Rp 248.000 |
| Retur buku | `ret-demo-1` | Aisyah, Cambridge Mathematics 1, `reported` |
| Order seragam | `USO-DEMO-01..05` | partial / paid / unpaid / unpaid / paid cabang 2 |
| PO seragam | `UPO-DEMO-2026-02` | diterima sebagian |
| IPO | `IPO-202610-0001/0002` | submitted / partial_fulfilled |
| Surat jalan internal | `SJ-INT-202610-0001..0004`, `SJ-PUSH-202610-0001` | transit / diterima / diterima 10 bundel / selisih / push |
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
| PO Supplier & Retur Vendor | 12 |
| Refund Buku (staf) | 9 |
| Pesan ke Gudang / Pesanan dari Cabang | 13 |
| Gudang Seragam | 14 |
| Portal: Pesan Seragam & Retur Seragam | 15 |
| Rekonsiliasi | 16, 17 |
| Laporan | 18 |
| Dashboard | 18 |
| Pengaturan | 19 |
| Isolasi peran (semua akun) | 20 |

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
   - Tampil: Nathaniel, total Rp 990.000, tanpa ongkir; sudah dibayar Rp 500.000, sisa **Rp 490.000**.
2. Isi transfer **Rp 490.000**, alokasi buku **Rp 490.000**, bank **BCA**, referensi `BCA-NTH-0002`, unggah bukti → submit.
   - Muncul pesan **“Konfirmasi tercatat. Status akan diverifikasi admin.”**
3. Ulangi pola yang sama untuk:
   - `demo-token-buku-satuan` → sisa Rp 1.025.000.
   - `demo-token-seragam-01` → tagihan Rp 245.000; sudah dibayar Rp 100.000, sisa Rp 145.000.
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
3. Demo tolak: pada order seragam **USO-DEMO-03** buka verifikasi struk `MND-SRG-0002` (Rp 248.000) → **Tolak** dengan alasan.
   - Sistem mengirim ulang tautan bayar yang sama; orang tua bisa unggah ulang.
4. Demo kasir: pada **Hendra** (`ORD-202609-004`, Rp 1.350.000) klik **Catat Pembayaran**:
   - total transfer Rp 1.350.000, alokasi buku Rp 1.350.000, bank BCA, referensi baru → order lunas.
5. Demo diskresi: pada order lain klik **Diskresi Finance** → pilih `discount`, isi nominal + catatan wajib → total tagihan turun.
6. Demo beasiswa pada Bab 9 bila belum.

**Verifikasi:** badge pembayaran berubah `partial` → `paid`; struk yang ditolak tidak menambah `paidAmount`.

---

## 12. Skenario 7 — Invoice WhatsApp, ongkir, dan halaman bayar

**Tujuan:** membuktikan Invoice WhatsApp hanya terkirim setelah ongkir/resi (untuk satuan/seragam) dan tautan bayar bekerja.

1. Di **Pesanan Siswa**, pilih order satuan Salsabila (`ORD-202610-102`).
   - Sudah ada ongkir Rp 25.000 + resi `JNE-BKU-0002` dan `invoiceSentAt`.
2. Ganti ongkir lewat **Input Ongkir** bila perlu; tombol **Kirim Ulang Invoice** aktif hanya saat ongkir/resi terisi.
3. Buka tautan bayar:
   - `demo-token-buku-nathan` (Bab 10) → kirim Rp 490.000 → verifikasi (Bab 11) → lunas.
   - `demo-token-buku-satuan` → kirim termin bebas, mis. Rp 500.000.
4. Untuk seragam: buka **Gudang Seragam → Pengiriman**, order `USO-DEMO-01`.
   - Ongkir Rp 15.000, resi `JNE-SRG-0001`; kirim Invoice WhatsApp; buka `demo-token-seragam-01`.
5. `USO-DEMO-03` sudah punya struk pending Rp 248.000 (barang + ongkir); verifikasi → order seragam **lunas**.

**Verifikasi:** token tidak valid → `404 Link konfirmasi tidak valid`; order lunas menolak klaim baru.

---

## 13. Skenario 8 — Serah terima buku dan Bukti Pengambilan / Surat Jalan

**Tujuan:** membuktikan serah-terima membuat nomor `SJ-SERAH-*` dan mengikat bundel fisik berdasarkan Bukti Pengambilan wali murid.

1. Login `admin.pusat@alwildan.sch.id` → **Pesanan Siswa**.
2. Cari **Kayla** (`ORD-202610-101`, lunas, `waiting_preparation`), minta wali murid menunjukkan **Bukti Pengambilan** (dokumen tanda terima resmi dengan kode konfirmasi unik).
3. Klik **Serahkan Buku**:
   - Nama pengambil: `Hj. Ramadhani (Ibu)`.
   - Konfirmasi serah-terima.
4. Hasil:
   - Status pemenuhan menjadi `picked_up`.
   - Nomor surat jalan serah-terima `SJ-SERAH-*` terbit sebagai arsip sekolah.
   - Siswa ditandai sudah menerima paket; satu bundel berstatus terkirim.
5. Cetak atau tinjau dokumen serah-terima dari modal konfirmasi.
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

## 15. Skenario 10 — Katalog, paket, dan rakit/bongkar bundel

**Tujuan:** membuktikan master buku, BOM paket, dan stok dua lapis (satuan vs bundel).

1. Login `admin.gudang@alwildan.sch.id` → tab **Katalog**.
   - 12 judul + buku WPR tampil; coba tambah satu judul baru, unggah cover, lalu hapus.
   - Judul publik yang diisi seed dipakai portal (bukan “Buku Paket”).
2. Buka **Paket & Rakit**.
   - Empat paket dengan harga mengikuti BOM + WPR (Bab 4.2).
   - Paket Kelas 1 Internasional: **sisa 4 bundel siap** (15 awal − 1 untuk Aisyah − 10 distribusi awal tahun ke Al Wildan 1).
   - Komponen satuan dan “potensi rakit” dihitung dari stok terkecil.
3. **Rakit Bundling** Paket Kelas 1 Internasional sebanyak **1 paket** → stok satuan berkurang, stok bundel bertambah.
4. **Bongkar Paket** 1 bundel dengan alasan wajib (mis. “penggantian buku rusak”) → kembali menjadi stok satuan.
5. Coba rakit melebihi potensi → tombol ditolak/validasi merah.

**Verifikasi:** buku WPR tidak mengurangi stok fisik saat rakit; alasan wajib saat bongkar.

---

## 16. Skenario 11 — Stok satuan dan penjualan langsung di gudang pusat

**Tujuan:** membuktikan pergerakan stok satuan hanya melalui PO baru, rakit/bongkar paket, atau penjualan langsung ad-hoc ke orang tua. Tidak ada transfer buku satuan antar sekolah.

1. Login gudang → **Stok Satuan**.
   - Ringkasan per judul: stok satuan, bundel siap, nilai stok.
2. Pilih judul buku untuk simulasi penjualan langsung:
   - Pilih Cambridge Mathematics 1 ×1 dan Cambridge Global English 1 ×1.
   - Baris yang dipilih menampilkan total kuantitas dan nilai estimasi.
3. Klik **Jual ke Ortu** (hanya aktif saat lokasi akun berada di Gudang Logistik Pusat).
4. Isi data pembeli:
   - Nama pembeli (mis. `Ibu Ratna Dewi`) dan nomor WhatsApp aktif (`081298765432`).
   - Pembayaran tunai kasir gudang.
   - Konfirmasi penjualan langsung.
5. Order `DIR-*` berhasil dibuat, stok satuan di gudang pusat langsung berkurang saat itu juga. Riwayat `DIR-202610-001` adalah contoh hasil penjualan langsung yang sudah ada di database demo.

**Verifikasi:** stok satuan langsung terpotong; transaksi penjualan langsung masuk ke laporan keuangan kanal “langsung”.

---

## 17. Skenario 12 — PO supplier dan Retur Vendor (RTV)

**Tujuan:** membuktikan alur pengadaan dari penerbit/vendor, riwayat penerimaan barang, serta pencatatan retur vendor dan nota kredit langsung via antarmuka web.

1. Tab **PO Supplier**.
   - `PO-202609-0088` berstatus **diterima sebagian**, dengan riwayat penerimaan `SJ-SUP-202609-001` (40 Mathematics + 40 Science).
   - Ringkasan kuantitas diterima = total baris penerimaan.
2. **Buat PO Baru** → pilih supplier, buku, kuantitas, estimasi tiba → simpan (`draft`).
3. Alur dokumen PO: **Tandai Dicetak** → unggah bukti tanda tangan (gambar/PDF) → **Terima Barang** dengan nomor surat jalan supplier.
   - Penerimaan menambah eksemplar fisik + stok; status menjadi `partially_received` atau `received`.
4. Di bagian bawah tab PO Supplier, lihat tabel **Retur ke Supplier (Vendor Returns)**:
   - Dokumen demo `RTV-202610-0001` tampil dengan supplier Penerbit Erlangga, alasan cacat cetak, credit note Rp 285.000, status **Selesai**, dan 3 eksemplar Mathematics berstatus disposed.
   - Klik **Detail** untuk melihat rincian buku yang diretur.
5. Klik tombol **Buat Retur Vendor**:
   - Pilih Supplier (mis. Penerbit Erlangga).
   - Pilih PO terkait (atau umum), isi alasan retur (mis. "Halaman terbalik & jilid rusak"), dan nominal nota kredit (mis. Rp 150.000).
   - Tambahkan judul buku dan kuantitas yang diretur → **Simpan Retur**.
   - Sistem menerbitkan nomor `RTV-*` baru, mencatat nota kredit, dan menandai unit buku terkait menjadi disposed.

**Verifikasi:** PO yang sudah diterima penuh tidak menawarkan penerimaan lagi; retur vendor berhasil dicatat dan mengurangi stok cacat via UI tanpa CLI.

---

## 18. Skenario 13 — Pesanan internal, surat jalan, selisih, dan push distribution

1. Login `admin.cabang2@alwildan.sch.id` → tab **Pesan ke Gudang**.
   - `IPO-202610-0001` berstatus **Diajukan**: 2 paket Kelas 2 Internasional, terpenuhi 0.
2. Login gudang → **Pesanan dari Cabang**.
   - `IPO-202610-0002` (Al Wildan 1) berstatus **Sebagian**: 4 dipesan, 2 terpenuhi.
   - Riwayat surat jalan menampilkan `SJ-INT-202610-0001` (transit), `SJ-INT-202610-0003` (10 bundel diterima).
3. Buat surat jalan baru untuk IPO yang belum terpenuhi → pilih paket + kuantitas → cetak.
4. Login cabang → **Terima Surat Jalan**:
   - Unggah bukti tanda tangan wajib.
   - Tandai satu baris `damaged`/`missing` → status menjadi **Selisih** (`SJ-INT-202610-0004` adalah contohnya).
5. **Push Distribution Awal Tahun** (gudang):
   - Pilih cabang dengan siswa aktif → kuota > 0 (Al Wildan 3 memenuhi syarat).
   - Kirim paket tanpa PO internal → tercatat `SJ-PUSH-202610-0001`.

**Verifikasi:** penerimaan tanpa bukti ditolak; surat jalan selisih tetap menyimpan kondisi per baris.

---

## 19. Skenario 14 — Operasi gudang seragam

1. Login `admin.seragam@alwildan.sch.id` → tab **Gudang Seragam**.
2. **Pengiriman**:
   - `USO-DEMO-01` tahap **konfirmasi** (dibayar Rp 100.000 dari tagihan Rp 245.000).
   - `USO-DEMO-02` **lunas** dan sudah dikirim.
   - `USO-DEMO-03` **tagihan** (invoice terkirim, belum dibayar).
   - `USO-DEMO-04` **pemesanan** (belum invoice).
   - `USO-DEMO-05` milik Al Wildan 2, lunas + ongkir Rp 18.000.
3. Input ongkir + resi pada order yang belum final, lalu **Kirim Invoice** dan **Tandai Terkirim**.
4. **Katalog & PO**:
   - Terima sisa `UPO-DEMO-2026-02` (kain SD Laki-laki 5 dari 20; olahraga M 0 dari 20).
   - Catat reject varian olahraga SD Perempuan ukuran M qty 2 (`ur-demo-01`).
   - Rakit paket seragam dan cek stok paket (SD L/P 4, SMP L 5).
5. **Tukar & Refund**:
   - Tukar `ex-demo-01` (Kayla, S→M) masih `requested`; `ex-demo-02` sudah selesai.
   - Refund `rf-demo-01` masih `requested`; `rf-demo-02` sudah `refunded`.
6. **Laporan**: unduh CSV penjualan seragam; stok dan klaim tampil.

**Verifikasi:** penerimaan PO menambah stok varian+ukuran yang benar; menyelesaikan tukar memindahkan stok ukuran.

---

## 20. Skenario 15 — Portal seragam, tukar ukuran, dan refund

1. Buka `/seragam` → pilih **Al Wildan 1**.
2. Cari `Kayla` (sudah punya order seragam, boleh beli satuan):
   - Pilih olahraga SD Perempuan ukuran **M** ×1 → Rp 110.000, atau paket SD Perempuan Rp 230.000.
   - Sistem meminta ukuran untuk paket dan alamat rumah (RT/RW/kode pos).
   - Submit → order `USO-*` baru, status kirim `belum dikirim`, pembayaran belum lunas.
3. Aturan paket pertama: cari murid yang **belum pernah** pesan seragam (mis. `Fauzan` di Al Wildan 2). Coba hanya satuan → ditolak `Murid baru/pindahan wajib membeli paket seragam terlebih dahulu`.
4. Tab **Retur Seragam**:
   - Cari `Kayla` → pilih `USO-DEMO-04` → mode **Tukar Ukuran** → olahraga S → M → alasan → submit.
   - Cari `Farhan` → pilih `USO-DEMO-03` atau `-02` → **Refund Dana** (kosong = refund penuh) → alasan → submit.
5. Staf memproses di **Tukar & Refund**: setujui → selesaikan tukar; setujui → refund.

**Verifikasi:** tukar hanya untuk olahraga, bukan kain harian; pengajuan di luar 14 hari ditolak.

---

## 21. Skenario 16 — Rekonsiliasi finansial dan klaim cabang

1. Login gudang → tab **Rekonsiliasi** → sub-tab **Finansial & Klaim**.
2. Pilih Al Wildan 1 dan periode berjalan → **Muat**.
   - Uang masuk dari orang tua, alokasi ke order, sisa belum teralokasi.
   - Tagihan `open` (mis. Al Wildan 4) dan tagihan `final`.
   - Klaim `CLM-DEMO-<periode>` **draft Rp 1.920.000** (barang Rp 1.880.000 + ongkir Rp 40.000).
3. Bandingkan dengan Al Wildan 2:
   - Klaim `CLM-DEMO2-<periode>` **locked Rp 1.638.000**.
   - Drift harus **0** karena total klaim = jumlah tagihan final.
4. **Kunci** klaim Al Wildan 1 → status `locked`; tagihan baru setelah itu masuk periode berikutnya.
5. Buka detail tagihan: `TGH-DEMO-0006` masih `open` karena order belum diserahkan.

**Verifikasi:** tidak ada klaim yatim; nominal klaim tidak bisa berubah setelah lock.

---

## 22. Skenario 17 — Audit akhir periode dan Berita Acara

1. Masih di **Rekonsiliasi** → sub-tab **Audit Akhir Periode & Tagihan Hilang**.
2. Pilih Al Wildan 1, tahun ajaran `2026/2027`, term `Ganjil` → **Compile**.
   - Paket Kelas 1 Internasional: masuk **10**, tersalur **1**, sisa sistem **9**.
3. Isi sisa fisik **7** → selisih **2**; harga satuan Rp 1.420.000 → kerugian **Rp 2.840.000**.
4. **Finalisasi & Cetak Berita Acara** → service menerbitkan nomor BA baru (contoh yang sudah final: `BA-RECON-DEMO-0001`).
5. **Tarik Sisa** 7 paket → membuat surat jalan manual ke gudang; stok fisik cabang berkurang.
6. Riwayat BA tampil di daftar dengan total kerugian yang sama.

**Verifikasi:** finalisasi tanpa baris ditolak; angka compile = angka BA.

---

## 23. Skenario 18 — Laporan penjualan dan dashboard

1. Tab **Laporan** → rentang default bulan berjalan.
   - Total omzet, terbayar, piutang, jumlah order, beasiswa, ongkir, invoice terkirim, serah-terima.
   - Rincian per kanal: paket, satuan, penjualan langsung.
   - Rincian per kampus, program (kurikulum × kelas), kategori.
2. Unduh **CSV** dan cetak laporan.
3. Tab **Dashboard**:
   - Perbandingan 4 kampus + gudang tidak nol.
   - Donut kondisi: new/good/fair/damaged/lost.
   - Perhatian: 1 transfer `in_transit`, retur terbuka, PO diterima sebagian.

**Verifikasi:** filter kampus mengubah angka; CSV identik dengan tabel.

---

## 24. Skenario 19 — Pengaturan

1. Login `admin.gudang@alwildan.sch.id` → tab **Pengaturan**.
2. **Cabang Sekolah**: 5 lokasi (4 kampus + gudang). Tambah cabang baru → muncul di dropdown.
3. **Akun Staf**: 8 akun demo. Tambah akun `school_admin`; password awal `password123`.
4. **Email SMTP**: host/port/username/from terisi; password kosong. **Uji Kirim** berstatus simulasi (bukan error 502).
5. **WhatsApp Meta**: nomor terisi, token kosong, nonaktif → uji bersifat simulasi.
6. **Cut-off Satuan**: `2026/2027` terbuka sejak `2026-07-01`; coba override `closed` → mode satuan portal hilang, lalu kembalikan `open`.
7. **Seragam**: prefix `USO`/`CLM`; toggle seragam satuan aktif.

**Verifikasi:** perubahan cut-off langsung memengaruhi portal; hanya central admin melihat tab ini.

---

## 25. Skenario 20 — Isolasi peran dan checklist akhir

Login bergantian dan pastikan:

| Akun | Tab pertama | Tidak boleh terlihat |
|---|---|---|
| Central Admin | Dashboard | — |
| Admin Logistik | Dashboard | Pengaturan |
| Admin Gudang Buku | Pesanan dari Cabang | Gudang Seragam, Pengaturan |
| Admin Gudang Seragam | Gudang Seragam | Tab buku, Pengaturan |
| School Admin 1 / Branch 2–4 | Pesan ke Gudang | Tab gudang pusat, Pengaturan |

Uji data:

1. `admin.cabang2` hanya melihat siswa/order Al Wildan 2 (3 siswa).
2. `admin.cabang3` tidak bisa membuka order Al Wildan 1 lewat URL/aksi.
3. Central admin tetap melihat semua kampus.

**Checklist demo sukses:**

- [ ] Portal menampilkan paket terkunci sesuai kelas + kurikulum.
- [ ] Satuan + WPR muncul dan totalnya Rp 1.000.000.
- [ ] Murid baru tidak bisa memesan sebelum NIS disetujui.
- [ ] Beasiswa butuh bukti dan persetujuan staf.
- [ ] Klaim portal menjadi struk pending; verifikasi staf mengubah status.
- [ ] Halaman `/bayar` menghitung total + ongkir dan menerima Invoice WhatsApp.
- [ ] Serah-terima menerbitkan `SJ-SERAH-*` dan mengikat bundel dengan Bukti Pengambilan.
- [ ] Refund buku bisa ganti/tolak/refund.
- [ ] Rakit dan bongkar mengubah stok dua lapis.
- [ ] Stok satuan di gudang pusat dapat dijual langsung (ad-hoc) ke orang tua.
- [ ] PO supplier punya riwayat penerimaan dan Retur Vendor (RTV) dapat dicatat via UI.
- [ ] IPO, surat jalan, selisih, dan push berfungsi.
- [ ] Seragam: PO parsial, reject, tukar, refund.
- [ ] Rekonsiliasi menampilkan klaim tanpa drift.
- [ ] Audit periode menghasilkan BA + tagihan hilang.
- [ ] Laporan dan dashboard terisi.
- [ ] Pengaturan memengaruhi portal.
- [ ] Semua akun terisolasi sesuai perannya.

---

## 26. Troubleshooting

| Gejala | Penyebab | Tindakan |
|---|---|---|
| Mode satuan tidak muncul | Cut-off `2026/2027` tertutup | Pengaturan → Cut-off → override `open` |
| `/bayar/...` 404 | Token tidak ada / order belum invoice | Kirim invoice dari Pesanan Siswa atau Gudang Seragam |
| Kuota push 0 | Cabang belum punya siswa aktif | Gunakan Al Wildan 2/3/4 (sudah diisi seed) |
| Order seragam satuan ditolak | Murid belum pernah membeli paket | Pilih paket pada order pertama |
| Data demo tidak muncul setelah re-seed | Baseline vs pack | Pastikan memanggil `/api/demo/seed` (pack), bukan seed baseline |
| Bukti foto tidak terbuka | Seed lama menyimpan URL storage | Jalankan ulang seed demo (bukti diganti data URL) |
| Harga paket berbeda dengan order | Seed lama sebelum penyelarasan | Jalankan ulang seed demo |
| Test berjalan di DB salah | Preload isolasi dimatikan | Jangan hapus `bunfig.toml` preload; jalankan `bun test` biasa |

### Reset cepat

```bash
# lokal: hapus DB demo lalu bangun ulang
Remove-Item ./data/inventory.db
bun run db:push
# lalu login central → seed demo (atau POST /api/demo/seed)

# D1: ekspor seed idempoten
bun run db:d1:seed:export
bun run db:d1:seed
```

