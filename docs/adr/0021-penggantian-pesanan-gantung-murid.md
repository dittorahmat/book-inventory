# ADR-0021: Penggantian Pesanan Gantung Murid (Superseded Orders) dan Realokasi Pembayaran

## Context

Sering kali orang tua murid berubah pikiran di tengah jalan setelah membuat pesanan di portal publik (misal: pindah kurikulum sehingga paket buku berganti, salah memilih ukuran seragam, atau revisi kombinasi buku satuan), sementara pesanan sebelumnya masih berstatus gantung (belum diserahterimakan untuk buku, atau belum dikirim dan belum ada nomor resi untuk seragam).

Sebelumnya, pengajuan pesanan berulang untuk murid yang sama berpotensi menimbulkan pesanan ganda yang membingungkan alokasi stok gudang, atau sebaliknya jika ditimpa otomatis tanpa konfirmasi akan merusak pesanan suplemen/tambahan (add-on) serta mengacaukan pembukuan dana yang sudah masuk.

## Decision

1. **Scope Terisolasi per Domain**:
   - Pesanan buku hanya menimpa pesanan buku gantung.
   - Pesanan seragam hanya menimpa pesanan seragam gantung.
   - Pesanan buku tidak memengaruhi pesanan seragam murid yang sama.

2. **Batas Status Layak Ganti (Gantung)**:
   - **Buku**: Boleh digantikan selama `handoverStatus !== 'completed'` (belum diserahterimakan fisik).
   - **Seragam**: Boleh digantikan selama `shipmentStatus === 'belum_dikirim'` dan belum diterbitkan nomor resi kurir.

3. **Intensi Penggantian Terbimbing (Eksplisit di Portal)**:
   - Jika portal mendeteksi pesanan gantung pada murid bersangkutan, pemesan diberikan opsi eksplisit:
     1. *"Ganti Pesanan Lama"* (merevisi pesanan).
     2. *"Buat Pesanan Tambahan"* (pesanan baru berdiri sendiri).

4. **Status `superseded` & Pelepasan Fisik (Atomic Stock Unassign)**:
   - Pesanan lama tidak di-hard delete, melainkan diberi status `superseded` dan mereferensikan `supersededByOrderId`.
   - Seluruh alokasi stok fisik lama (`package_items` / `book_items`) dilepas kembali ke stok bebas cabang/gudang dalam batch transaksi yang sama sebelum alokasi pesanan baru ditarik.

5. **Realokasi Finansial & Struk Bank (`payment-ledger`)**:
   - Struk fisik rekening bank (`payment_receipts`) tidak diubah.
   - Baris alokasi lama (`payment_allocations`) dialihkan ke pesanan baru via modul kanonik `payment-ledger`.
   - **Kurang bayar**: Pesanan baru berstatus `partial` dengan sisa tagihan tercatat.
   - **Lebih bayar**: Alokasi dibatasi maksimal sebesar nilai pesanan baru (status `paid`), dan kelebihan dana otomatis masuk antrean Refund Pending Finance.
   - **Beasiswa**: Status `scholarship_approved` dan dokumen bukti beasiswa disalin otomatis ke pesanan baru.

6. **Penyajian Portal Publik**:
   - Pesanan baru menjadi kartu utama.
   - Pesanan lama bertanda `superseded` disajikan di accordion riwayat dengan label keterangan *"Telah Digantikan oleh #[NOMOR_PESANAN_BARU]"*.

## Consequences

- **Positif**: Orang tua dapat mengoreksi pesanan mandiri tanpa perlu pembatalan manual yang rumit oleh admin; uang dan bukti transfer yang sudah diunggah tidak hilang; akuntabilitas audit mutasi bank dan stok fisik tetap 100% terjaga.
- **Trade-off**: Dibutuhkan logika transaksional atomik saat melepas stok lama dan mengalokasikan stok baru, serta UI portal publik perlu menampilkan dialog konfirmasi saat mendeteksi pesanan gantung.
