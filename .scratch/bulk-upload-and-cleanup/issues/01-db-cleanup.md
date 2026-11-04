# 01: Database Reset & Purge Tooling (Lokal & Remote D1)

**What to build:**
Script dan endpoint terpadu untuk pembersihan data operasional (orders, order items, stock, shipments, receipts, payments, claims, returns, uniform variants/stock/orders, student book orders) serta murid dan katalog buku pada SQLite lokal dan Cloudflare D1 Remote (`book-inventory-db`), namun tetap menjaga master sekolah (`schools`) dan master akun login staf (`users`, `accounts`).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Script reset SQL terpadu untuk membersihkan tabel operasional, murid, dan katalog tanpa menghapus `schools` & `users`
- [ ] Eksekusi pembersihan pada SQLite lokal (`local.db`)
- [ ] Eksekusi pembersihan pada Cloudflare D1 remote (`book-inventory-db`)
- [ ] Verifikasi bahwa akun user admin dan sekolah tetap ada
