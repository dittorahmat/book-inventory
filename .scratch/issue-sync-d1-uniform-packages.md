## What to build
Menyinkronkan dan mengisi master data paket bahan kain seragam (`uniform_packages`) beserta Bill of Materials (`uniform_package_bom`) ke database remote Cloudflare D1 production (`book-inventory-db`). 

Saat ini remote D1 memiliki `COUNT(*) = 0` pada tabel paket seragam sehingga portal publik tidak menampilkan kartu paket kain harian sama sekali. Dengan tiket ini, remote D1 akan memiliki 8 paket bahan kain harian lengkap (TK/SD/SMP/SMA Ikhwan & Akhwat) untuk tahun ajaran aktif, dan endpoint `/api/public/uniform-orders/catalog` mengembalikan daftar paket kain yang siap dipilih orang tua.

## Acceptance criteria
- [ ] Data 8 paket bahan kain harian (`uniform_packages`) dan BOM kain komponennya (`uniform_package_bom`) terisi di Cloudflare D1 remote via runner kanonik (`bun run db:d1:batch` / skrip sync).
- [ ] Endpoint publik `/api/public/uniform-orders/catalog?academicYear=2026%2F2027` pada host production mengembalikan array `packages` dengan minimal 8 paket kain lengkap dan status BOM valid.
- [ ] Kartu paket kain harian muncul di portal publik pemesanan seragam ketika siswa dipilih.

## Blocked by
- None (can start immediately)
