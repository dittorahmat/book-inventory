# 02: Multi-Branch Selector & Orders Table for Book Orders View (UI)

**What to build:**
Menyediakan dropdown pemilih cabang ("Semua Cabang" + daftar cabang) pada tampilan Pesanan Buku Siswa (`StudentOrdersView`) untuk role Central Admin dan Admin Gudang, serta menampilkan badge/nama sekolah pada tabel pesanan saat mode semua cabang aktif.

**Blocked by:** 01-book-orders-api-hook

**Status:** ready-for-agent

- [ ] `StudentOrdersView` menerima daftar `schools` dari `staff-tab-views.tsx`
- [ ] Dropdown filter cabang tersedia di header `StudentOrdersView` dengan opsi "Semua Cabang" (default untuk admin global)
- [ ] Tabel `StudentOrdersTable` menampilkan kolom Cabang/Sekolah bila melihat Semua Cabang
- [ ] Seluruh aksi modal (serah terima, ongkir, discretion, review bayar) tetap berfungsi normal
- [ ] Test UI & render komponen terverifikasi
