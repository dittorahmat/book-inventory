# Pemenuhan tanpa status "dikemas"

Status pemenuhan order hanya punya tahap yang **diikuti keputusan**. Buku: `waiting_preparation` → `ready_for_pickup` → `picked_up`. Seragam: `belum_dikirim` → `sudah_dikirim`. Buku satuan kirim-rumah punya flag dua-state sendiri. Tidak ada status "dikemas" di antara disiapkan dan dikirim.

## Considered Options

- Menambah `dikemas` sebagai tahap ketiga (ditolak: tidak ada satu pun keputusan bisnis yang bergantung padanya — tidak ada laporan, izin, atau aksi yang berubah saat sebuah order "dikemas"; menambah state hanya menambah kombinasi yang harus dijaga di UI, test, dan laporan).
- State minimal sesuai keputusan (dipilih).
- State kaya ala WMS (ditolak: model gudang besar untuk operasi satu sekolah).

## Consequences

Kalau gudang butuh menandai "sudah diambil dari rak", itu milik dokumen picking/packing internal — bukan status order yang terlihat wali, dan bukan sinyal yang menggerakkan pembayaran atau pengiriman. Mengusulkan status baru wajib menyertakan **keputusan apa yang bergantung padanya**; tanpa itu, usulannya ditolak karena menambah biaya jaga tanpa manfaat.
