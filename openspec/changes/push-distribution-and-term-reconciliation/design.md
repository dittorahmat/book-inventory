# Design: Push Distribution and Term Reconciliation

## Context

Sistem saat ini mengelola pergerakan stok antar-sekolah dan transfer pengiriman internal (`stock_transfers`, `shipments`). Pada pengadaan cabang sebelumnya, diasumsikan cabang harus selalu membuat PO Internal terlebih dahulu. Pada realitas operasional sekolah, di awal tahun ajaran Gudang Pusat langsung melakukan distribusi massal berdasarkan data siswa aktif di cabang (Cap Max).

Pada akhir periode ajaran (*end of term*), penyerahan buku ke siswa telah selesai dan tersimpan di `student_book_orders` / log penyerahan. Tim logistik gudang kemudian melakukan stock opname fisik di cabang. Dibutuhkan mekanisme komparasi otomatis antara buku masuk, buku terdistribusi, dan sisa fisik aktual. Jika ada buku yang hilang, Gudang Logistik menerbitkan Berita Acara Rekonsiliasi & Nota Tagihan (Billing Memo) ke Finance Cabang berbasis harga jual buku, disertai cetak lampiran bukti penyerahan siswa. Sisa fisik yang masih ada dikembalikan ke Gudang Pusat dan dapat dibongkar (*unbundle*) kembali menjadi stok satuan.

## Goals / Non-Goals

**Goals:**
- **Push Distribution Generator**: Antarmuka di Gudang Pusat untuk melihat kuota Cap Max siswa per kelas/jenjang di cabang dan menerbitkan Surat Jalan (SJ) distribusi langsung satu arah tanpa mensyaratkan PO cabang.
- **Modul Rekonsiliasi Akhir Periode (Term Reconciliation)**:
  - Mengagregasi: Total Terkirim (`Inbound`) - Total Diserahkan (`Handover`) = `Target Sisa Sistem`.
  - Menginput `Fisik Aktual` dan mendeteksi `Selisih (Loss)`.
- **Berita Acara & Tagihan Selisih (Printable)**:
  - Menghasilkan Berita Acara Rekonsiliasi Stok & Memo Tagihan Cabang.
  - Nilai tagihan = `Jumlah Selisih x Harga Jual Resmi`.
  - Lampiran cetak Rekapitulasi Penyerahan Buku Siswa.
- **Penarikan Sisa & Unbundle**:
  - Menerbitkan SJ pengembalian sisa stok fisik ke Gudang Pusat.
  - Integrasi dengan fitur unbundle untuk membongkar paket sisa menjadi buku eceran di Gudang Pusat.

**Non-Goals:**
- Mengubah integrasi sistem akuntansi/general ledger pihak ketiga (cukup menghasilkan Berita Acara & Billing Memo tercetak/PDF yang diserahkan ke Finance Cabang).
- Menghapus modul PO Internal Cabang (PO tetap ada untuk kebutuhan ad-hoc/susulan siswa pindahan di pertengahan semester).

## Decisions

### 1. Model Data Rekonsiliasi Periode
Menambahkan tabel baru di `src/db/schema.ts`:
- `term_reconciliations`:
  - `id`: string (idSchema)
  - `school_id`: string FK `schools.id`
  - `academic_year`: string (misal: "2026/2027")
  - `term`: string (misal: "Ganjil" / "Genap")
  - `status`: `'draft' | 'submitted' | 'finalized'`
  - `notes`: text
  - `created_by`: string FK `users.id`
  - timestamps
- `term_reconciliation_items`:
  - `id`: string (idSchema)
  - `reconciliation_id`: FK `term_reconciliations.id`
  - `item_type`: `'package' | 'book'`
  - `package_id`: string nullable FK `book_packages.id`
  - `book_id`: string nullable FK `books.id`
  - `total_inbound`: integer (total unit terkirim ke cabang)
  - `total_distributed`: integer (total unit diserahkan ke siswa)
  - `system_remaining`: integer (`total_inbound - total_distributed`)
  - `physical_remaining`: integer (input audit logistik)
  - `discrepancy_quantity`: integer (`system_remaining - physical_remaining`)
  - `unit_price`: integer (harga jual resmi per unit)
  - `total_loss_amount`: integer (`discrepancy_quantity * unit_price`)

### 2. Dokumen Penagihan dan Berita Acara
- Format nomor dokumen menggunakan helper kanonik `documentNumber("BA-RECON")` dan `documentNumber("MEMO-LOSS")`.
- Format view cetak (print stylesheet) menampilkan kop sekolah/logistik, tanda tangan 3 pihak (Logistik, Kepala Cabang, Finance Cabang), rincian selisih stok, serta lampiran daftar nama siswa penerima buku.

### 3. Push Distribution Satu Arah
- Menambahkan tipe transfer/pengiriman khusus `'push_distribution'` pada modul pengiriman internal atau mengizinkan `shipments` diterbitkan tanpa kaitan `po_id`.
- Gudang Pusat dapat memfilter siswa cabang berdasarkan `status = 'active'` dan mengelompokkan berdasarkan jenjang/kelas untuk menentukan kuota Cap Max.

## Risks / Trade-offs

- **Penyerahan Manual di Luar Sistem**: Jika cabang menyerahkan buku ke siswa tanpa menginput ke sistem serah terima, sistem akan menghitung buku tersebut sebagai "masih ada di rak", sehingga bisa salah terdeteksi sebagai "hilang" saat audit fisik.
  - *Mitigasi*: Sesi rekonsiliasi menampilkan status pesanan siswa yang belum diambil (uncollected) sehingga admin cabang dan logistik dapat melakukan verifikasi/kroscek sebelum finalisasi berita acara.
- **Unbundling Paket Sisa**: Paket yang dikembalikan mungkin ada yang kondisinya rusak/terbuka.
  - *Mitigasi*: Saat penerimaan kembali di Gudang Pusat, stok dapat diterima sebagai paket utuh atau langsung masuk proses unbundling ke buku satuan dengan verifikasi kondisi fisik.
