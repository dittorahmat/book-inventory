# 05: Konsolidasi Tab Gudang Buku Menjadi Satu Tab Terpadu (Central Admin & Admin Gudang Buku)

**What to build:**
1. Seluruh modul operasional gudang buku (Katalog & Paket, Rakit Buku, Stok Buku, PO Supplier / Inbound, Kirim Ke Cabang / Surat Jalan, Retur, Rekonsiliasi) disatukan ke dalam 1 tab induk kanonik "Gudang Buku" dengan sub-navigasi internal yang rapi dan responsif.
2. Perubahan navigasi yang ringkas dan bersih ini aktif baik untuk role `central_admin` maupun `warehouse_books_admin` / `warehouse_admin`, sementara role cabang sekolah tetap melihat view cabang mereka sesuai hak aksesnya tanpa regresi.

**Blocked by:** 01: Fix Modal Scroll & Sticky Actions pada Penerimaan PO Susulan, 02: Fix Popover & Z-Index Dropdown Pemilihan Paket di Surat Jalan Internal

**Status:** ready-for-agent

- [ ] Definisi tab staf dikonsolidasikan dengan tab "Gudang Buku" untuk central admin dan gudang buku
- [ ] Sub-navigasi internal menghubungkan semua seksi gudang buku dengan mulus
- [ ] Role sekolah tetap terisolasi pada view yang diizinkan
- [ ] Seluruh unit & integration test tab navigasi (`staff-tabs.test.ts`, dll.) hijau
