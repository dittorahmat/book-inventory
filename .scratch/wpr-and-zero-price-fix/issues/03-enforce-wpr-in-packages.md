# 03: Penegakan WPR BOM Wajib pada Pembuatan & Impor Paket Buku

**What to build:**
Memastikan setiap pembuatan paket buku—termasuk impor katalog massal otomatis (`autoCreatePackages`)—wajib menyertakan item `book-wpr-weekly-report` di relasi BOM (`book_package_items`). Menggunakan nominal WPR aktif untuk sinkronisasi harga all-in paket melalui seam `recalcPackagePrice` (§0.28).

**Blocked by:** 02: Pengaturan Dinamis Nominal WPR di Sistem & Tampilan Admin

**Status:** ready-for-agent

- [ ] Impor katalog massal (`book-catalog-import.ts`) otomatis memanggil `ensurePackageHasWpr` pada setiap paket baru/yang diperbarui.
- [ ] Baris buku WPR di katalog diperbarui dengan harga aktif WPR dari settings.
- [ ] Perhitungan harga paket mencakup komponen WPR secara deterministik.
- [ ] Integration test memverifikasi bahwa paket buku yang terbentuk otomatis memiliki WPR di BOM.
