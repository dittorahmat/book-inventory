# 02: Pengaturan Dinamis Nominal WPR di Sistem & Tampilan Admin

**What to build:**
Menyimpan konfigurasi harga WPR (Weekly Progress Report) di tabel `system_settings` (key: `book_wpr_price`) dengan nilai fallback default Rp 750.000. Menyediakan helper kanonik di server untuk mengambil harga aktif WPR, endpoint API `/api/settings/wpr-price`, dan input field pengaturan di menu Admin Settings.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Helper `getWprPriceSetting(db)` & `setWprPriceSetting(db, price)` membaca dan menulis ke `system_settings`.
- [ ] Endpoint `GET /api/settings/wpr-price` dan `POST /api/settings/wpr-price` terpasang dengan validasi angka positif dan otorisasi admin.
- [ ] UI Pengaturan memiliki komponen kontrol harga WPR dengan tombol Simpan.
- [ ] Unit & router test memverifikasi perubahan harga dan validasi input.
