# Proposal: Push Distribution and Term Reconciliation

## Why

Operasional logistik buku saat ini mengharuskan cabang menerbitkan Purchase Order (PO) internal terlebih dahulu sebelum Gudang Pusat dapat mengirimkan buku. Pada awal tahun ajaran baru, alur ini memperlambat distribusi massal karena cabang harus menginput pesanan manual, padahal kebutuhan buku di cabang sudah dapat diproyeksikan langsung dari jumlah siswa terdaftar (Cap Max).

Selain itu, pada akhir periode/tahun ajaran (*end of term*), belum tersedia mekanisme formal untuk rekonsiliasi sisa stok fisik di cabang dengan catatan penyerahan buku ke siswa. Ketika terjadi selisih fisik (buku hilang di cabang), gudang logistik membutuhkan dasar hukum audit yang sah berupa Berita Acara Rekonsiliasi & Tagihan Susulan (Billing Memo) berbasis harga jual resmi buku yang dapat dicetak dan ditagihkan ke pihak Finance Cabang, sementara sisa fisik yang ada ditarik kembali ke Gudang Pusat dan dapat dibongkar (*unbundle*) kembali menjadi stok satuan.

## What Changes

- **Push Distribution Awal Tahun Ajaran**: Gudang Pusat dapat menerbitkan Surat Jalan (SJ) distribusi massal langsung satu arah ke cabang berbasis kuota kapasitas maksimal (Cap Max) siswa per jenjang/kelas tanpa menunggu PO dari cabang. Cabang cukup melakukan konfirmasi penerimaan (*Receive SJ*). PO ad-hoc dari cabang hanya bersifat opsional untuk siswa susulan/pindahan.
- **Audit & Rekonsiliasi Akhir Periode (End of Term Reconciliation)**: Modul pencatatan stock opname akhir periode yang membandingkan:
  - Total stok masuk (Inbound SJ)
  - Total penyerahan ke siswa (Handover Log)
  - Target sisa stok seharusnya
  - Hitungan fisik aktual oleh tim logistik di cabang
- **Berita Acara Rekonsiliasi & Tagihan Selisih (Loss Billing Memo)**:
  - Jika stok fisik sesuai, seluruh sisa fisik dibuatkan SJ Pengembalian (*Return to HQ*).
  - Jika terdapat selisih fisik/hilang, sistem menerbitkan Berita Acara Selisih & Dokumen Tagihan resmi ke Finance Cabang yang bernilai: `Kuantitas Hilang x Harga Jual Resmi Buku/Paket`, dilengkapi lampiran Rekapitulasi Laporan Penyerahan Buku ke Siswa yang dapat dicetak (Printable).
- **Penarikan & Pembongkaran Stok Sisa (Return & Unbundle)**: Alur penarikan sisa paket fisik kembali ke Gudang Pusat dengan opsi untuk dibongkar (*unbundle*) kembali menjadi stok buku eceran/satuan.

## Capabilities

### New Capabilities
- `push-distribution-management`: Penentuan alokasi distribusi satu arah dari Gudang Pusat ke cabang berbasis data siswa aktif (Cap Max) dan penerbitan SJ distribusi otomatis.
- `term-stock-reconciliation`: Pencatatan audit rekonsiliasi stok cabang akhir periode, kalkulasi variansi selisih fisik vs sistem, penerbitan Berita Acara, serta faktur tagihan ganti rugi buku hilang ke Finance Cabang.

### Modified Capabilities
- `branch-internal-procurement`: Menjadikan pengajuan PO internal dari cabang bersifat opsional (ad-hoc / susulan saja), bukan prasyarat wajib untuk pengiriman distribusi awal tahun dari Gudang Pusat.

## Impact

- **Database Schema**: Penambahan tabel rekonsiliasi periode (`term_reconciliations`, `term_reconciliation_items`, dan dokumen berita acara / memo penagihan cabang).
- **Backend API Routes**: Endpoint untuk kalkulasi kuota siswa per cabang, inisiasi batch push delivery SJ, formulir audit rekonsiliasi akhir periode, dan cetak dokumen Berita Acara + Tagihan.
- **Frontend Views**: Halaman *Push Distribution Wizard* untuk Gudang Pusat dan antarmuka *Term Reconciliation & Audit Report* beserta view cetak/PDF Berita Acara.
