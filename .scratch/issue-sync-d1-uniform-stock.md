## What to build
Menyinkronkan data baris stok seragam olahraga (`uniform_stock`) ke database remote Cloudflare D1 production (`book-inventory-db`).

Saat ini, remote D1 hanya memiliki 8 baris stok untuk kain harian dan 0 baris stok untuk varian seragam olahraga (`stock.length === 0`). Akibatnya, pada antarmuka admin Gudang Seragam, varian seragam olahraga hanya menampilkan total "0 unit" tanpa memunculkan daftar ukuran beserta stoknya.

Tiket ini memastikan seluruh varian seragam olahraga di D1 remote terisi entri stok untuk setiap ukuran yang didukung (S, M, L, XL, 2XL, 3XL, 4XL, 5XL) dengan relasi ID varian yang bersih dan valid.

## Acceptance criteria
- [ ] Seluruh varian seragam olahraga memiliki baris stok (`uniform_stock`) untuk setiap ukuran yang terdaftar di D1 remote via runner batch kanonik (`bun run db:d1:batch`).
- [ ] Endpoint `/api/uniforms/variants` pada remote production mengembalikan array `stock` yang berisi rincian ukuran untuk setiap varian seragam olahraga.
- [ ] Baris tabel seragam olahraga pada antarmuka admin Gudang Seragam memunculkan rincian per ukuran (`S: 0`, `M: 0`, dst.).

## Blocked by
- None (can start immediately)
