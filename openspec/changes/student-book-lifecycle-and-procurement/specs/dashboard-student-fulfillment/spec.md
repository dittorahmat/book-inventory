## Purpose

Menyediakan dashboard operasional terintegrasi untuk melacak matriks status murid (pembayaran vs fisik buku), mencetak surat jalan / bukti serah terima buku, serta menangani retur dan penggantian buku cacat fisik.

## ADDED Requirements

### Requirement: Dashboard Matriks Pemenuhan Buku Siswa
Sistem SHALL menyediakan dashboard yang memfilter siswa berdasarkan status pembayaran (unpaid, partial, paid, scholarship) dan status fisik paket buku (waiting_preparation, ready_for_pickup, picked_up, return_in_progress).

#### Scenario: Memfilter murid yang belum bayar tapi paket sudah siap
- **WHEN** Admin memilih filter pembayaran "unpaid" dan status buku "ready_for_pickup"
- **THEN** Sistem menampilkan daftar siswa yang sesuai beserta tombol untuk mengirim pengingat email

### Requirement: Surat Jalan dan Serah Terima Buku
Sistem SHALL menerbitkan nomor surat jalan / bukti serah terima ketika paket buku diserahkan kepada orang tua/murid, mencatat identitas penerima, waktu penyerahan, dan petugas yang melayani.

#### Scenario: Penyerahan paket buku kepada murid
- **WHEN** Petugas menyerahkan paket buku kepada orang tua dan mengonfirmasi serah terima di aplikasi
- **THEN** Sistem mengubah status buku menjadi "picked_up", mencatat waktu serah terima, mengurangi stok paket siap serah di cabang terkait, dan menerbitkan cetakan tanda terima / surat jalan

### Requirement: Penanganan Retur Buku Rusak atau Cacat
Sistem SHALL mencatat laporan retur buku satuan yang cacat atau rusak dari murid, mewajibkan unggahan foto bukti cacat, dan memfasilitasi penggantian buku dari stok satuan (loose stock).

#### Scenario: Penggantian buku cacat berhasil diproses
- **WHEN** Murid melaporkan buku Cambridge Math robek dengan lampiran foto bukti dan petugas menyetujui penggantian
- **THEN** Sistem mencatat transaksi retur, mengurangi 1 unit buku satuan kondisi "new" dari stok loose untuk diserahkan ke murid, dan mencatat 1 unit buku retur berstatus "damaged"
