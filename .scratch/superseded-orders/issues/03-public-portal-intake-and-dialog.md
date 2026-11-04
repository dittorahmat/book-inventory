# 03: Alur Intake Portal Publik & Dialog Konfirmasi Pesanan Gantung

**What to build:**
Penyempurnaan intake order publik (`/api/public/orders/submit` dan `/api/public/uniform-orders/orders`) agar mendeteksi pesanan gantung milik siswa yang sama dan mendukung payload eksplisit penggantian pesanan lama atau pembuatan pesanan baru.

**Blocked by:** 01: Skema Status superseded & Seam Pelepasan Alokasi Stok Atomik, 02: Seam Realokasi Finansial & Beasiswa via payment-ledger

**Status:** ready-for-agent

- [ ] Endpoint mendeteksi apakah siswa memiliki pesanan buku/seragam yang masih gantung (belum serah terima / belum kirim).
- [ ] UI Wizard pemesanan portal menampilkan dialog konfirmasi jika terdeteksi pesanan gantung: "Ganti Pesanan Lama" atau "Buat Pesanan Tambahan".
- [ ] Submit dengan flag penggantian mengeksekusi urutan atomik: mark `superseded` $\rightarrow$ unassign stok lama $\rightarrow$ buat pesanan baru & alokasikan stok baru $\rightarrow$ realokasi pembayaran.
- [ ] Test regresi alur submit portal dengan opsi ganti vs tambah.
