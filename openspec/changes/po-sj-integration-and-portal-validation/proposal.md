# Proposal

## Why

Berdasarkan uji coba lapangan terkini, terdapat kendala operasional pada alur pemesanan siswa dan rantai pasok internal antara Cabang dan Gudang Pusat:
1. **Portal Siswa**: Masih ada celah di mana paket buku menampilkan opsi "Kirim ke Rumah" padahal paket awal tahun wajib diserahkan langsung di kelas, serta tidak adanya validasi wajib unggah bukti transfer yang menyebabkan pesanan gantung tanpa verifikasi pembayaran.
2. **Pengadaan Cabang & Gudang Pusat**: PO Internal yang diterbitkan oleh cabang belum terhubung dan tersaji dengan baik pada dashboard antrean kerja Gudang Pusat.
3. **Penerbitan Surat Jalan**: Gudang Pusat memerlukan kemampuan memilih nomor PO Cabang yang masih terutang/belum terpenuhi dengan item saran yang fleksibel (editable), serta tetap menyediakan opsi pengiriman manual ad-hoc tanpa PO.
4. **Traceability & Konfirmasi**: Surat Jalan harus mencantumkan referensi PO, dan admin cabang wajib dapat melakukan konfirmasi penerimaan fisik untuk mengupdate status pemenuhan PO secara akurat.

## What Changes

- **Portal Pemesanan Siswa**:
  - Menonaktifkan opsi pengiriman ke rumah untuk pemesanan paket buku; opsi pengiriman ekspedisi ke rumah hanya diizinkan untuk pemesanan buku satuan susulan (buku rusak/hilang).
  - Memberlakukan validasi wajib unggah bukti transfer pembayaran (meskipun berupa bukti transfer gabungan/gelondongan SPP+buku). Tombol submit pesanan diblokir secara ketat apabila file bukti transfer belum diunggah.
- **Integrasi PO Cabang ke Gudang Pusat**:
  - Memperbaiki antarmuka dan query antrean kerja Gudang Pusat agar seluruh PO Internal dari Cabang dengan status aktif (`submitted`/`approved`/`partially_delivered`) langsung terlihat dan dapat diproses oleh staf Gudang Pusat.
- **Penerbitan Surat Jalan Berbasis PO Terutang**:
  - Menyediakan dropdown pemilihan nomor PO Cabang aktif yang berstatus belum terpenuhi atau terutang.
  - Menghasilkan daftar rincian item saran secara otomatis berdasarkan sisa backorder PO, dengan kolom kuantitas kirim yang tetap dapat diedit (editable suggestion) oleh staf gudang.
  - Menyediakan opsi toggle/radio "Pengiriman Manual Tanpa PO" untuk memfasilitasi pengiriman ad-hoc, penyangga buffer, atau penggantian darurat.
  - Dokumen fisik dan cetak Surat Jalan wajib mencantumkan nomor PO referensi dan keterangan kelengkapan (lengkap vs sebagian).
- **Konfirmasi Penerimaan Cabang**:
  - Menyediakan antarmuka konfirmasi penerimaan fisik bagi admin cabang saat Surat Jalan tiba.
  - Memperbarui status pemenuhan PO Internal secara otomatis (`partially_delivered` atau `completed`) berdasarkan akumulasi item yang berhasil diterima.

## Capabilities

### Modified Capabilities
- `branch-internal-procurement`: Menambahkan persyaratan pemilihan PO terutang pada pembuatan Surat Jalan, item saran yang editable, mode pengiriman manual tanpa PO, serta konfirmasi fisik penerimaan di cabang yang memperbarui status PO secara bertahap.

### New Capabilities
- `portal-order-checkout-validation`: Mengatur aturan validasi checkout portal siswa, yaitu pemblokiran submit tanpa bukti transfer serta pembatasan metode serah terima paket buku (hanya di sekolah).

## Impact

- **Frontend**:
  - `src/components/portal/StudentOrderStep.tsx` / `PackageSelectionStep.tsx`: Guard validasi upload bukti transfer dan filter opsi delivery method paket vs satuan.
  - Halaman Pembuatan Surat Jalan (`src/components/transfers/` / `internal-shipments`): Komponen pemilih PO terutang, tabel rincian editable suggestion, dan toggle mode manual.
  - Halaman Penerimaan Cabang: Modal/antarmuka konfirmasi fisik barang datang per Surat Jalan.
- **Backend / API**:
  - Endpoint PO Internal (`src/server/routes/internal-po.ts` atau `internal-shipments.ts`): Endpoint listing PO terutang untuk gudang pusat, pembuatan pengiriman dengan relasi PO opsional (bisa null untuk pengiriman manual), dan endpoint konfirmasi penerimaan.
  - Validasi schema Order Intake (`src/server/services/order-intake/`): Penegakan keberadaan bukti transfer sebelum pemesanan disimpan.
