# ADR-0019: Alur Pembatalan Pengunduran Diri Murid dan Penukaran Seragam

## Konteks
Siswa yang mengundurkan diri membutuhkan jalur resmi untuk membatalkan pesanan buku dan seragam melalui portal publik tanpa intervensi manual cabang yang rentan selisih inventori. Selain itu, terdapat kebutuhan penukaran seragam olahraga (tukar ukuran atau jenis karena salah kirim) dengan pengiriman fisik ke Gudang Pusat.

## Keputusan
1. **Pemisahan Wewenang Fisik & Finansial**:
   - Gudang memegang kendali atas verifikasi fisik barang (buku dan seragam), validasi surat pengunduran diri, serta konfirmasi resi kurir.
   - Persetujuan gudang menerbitkan **Slip Bukti Pengembalian Barang** resmi bernomor serial (`RET-B-*` untuk buku, `RET-U-*` untuk seragam).
   - Bagian Finance memegang kendali pencairan dana refund berdasarkan slip bukti pengembalian tersebut melalui alur `payment-ledger`.
2. **Pelepasan Alokasi Otomatis (Unassign Stock)**:
   - Jika buku belum diambil (`!handover`), persetujuan gudang atas pengunduran diri langsung membatalkan pesanan dan mengembalikan unit alokasi (paket maupun buku satuan) menjadi stok bebas (*available stock*) di cabang bersangkutan secara sistematis.
   - Jika buku sudah diambil, status berpindah ke `waiting_physical_return` hingga fisik diterima kembali di sekolah/gudang sebelum pelepasan stok dan penerbitan slip refund.
3. **Konfigurasi Alamat Retur Terpusat**:
   - Alamat pengiriman retur diset terpusat di `system_settings` (`warehouse_return_address`) dan disajikan secara publik kepada orang tua murid saat mengisi form pembatalan/penukaran.
4. **Alur Penukaran Seragam Olahraga**:
   - Pengajuan via portal tracking pesanan mewajibkan unggah bukti resi kurir retur ke gudang.
   - Saat gudang menerima fisik, sistem memeriksa ketersediaan ukuran pengganti. Jika ready, gudang langsung menerbitkan resi pengiriman baru; jika stok kosong, gudang memasukkan estimasi tanggal kirim (ETA) yang otomatis tampil di portal tracking orang tua.

## Konsekuensi
- Positif: Mencegah *ghost inventory* dan kebocoran dana refund; audit trail jelas antara verifikasi fisik gudang dan kasir finance.
- Negatif: Memerlukan penambahan tabel/kolom pelacakan retur dokumen dan integrasi UI form pengajuan di portal murid.
