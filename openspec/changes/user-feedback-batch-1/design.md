## Context

Lihat `proposal.md` (Why) untuk motivasi. Kondisi teknis saat ini yang membentuk pendekatan: skema Drizzle di `src/db/schema.ts` (tabel `books` satu harga, `bookPackages.price` manual, `purchase_orders` status `draft/ordered/sent/...`, `purchase_order_items` tanpa diskon, `schools` tipe `main/branch`, `users` peran `central_admin/branch_admin`); route Hono tanpa pola isolasi seragam (`dashboard.ts` sudah punya `DashboardActor`, `procurement.ts` belum memfilter aktor); storage abstraction R2/S3 sudah dipakai untuk bukti pembayaran; pola validasi ID fleksibel `z.string().min(1)`; gate kualitas AGENTS.md (migrasi D1 lokal+remote, type-check, lint, build, test, batas 400 baris/file).

## Goals / Non-Goals

**Goals:**
- Satu change terkoheren untuk 8 capability dengan urutan implementasi yang meminimalkan konflik skema (fondasi gudang+isolasi dan harga dulu, UI summary dan laporan kemudian).
- Semua perubahan skema termigrasi ke D1 lokal dan remote sebelum apply selesai.

**Non-Goals:**
- Migrasi status PO lama; multi-gudang; penghapusan row fisik barcode; detail laporan penjualan final (asumsi sementara, direvisi menyusul).

## Decisions

### D1. Gudang sebagai baris `schools` bertipe baru
Tambah enum `schools.type = "warehouse"` dan seed satu baris "Gudang Logistik". Alternatif entitas tabel baru ditolak: semua FK (`currentSchoolId`, `targetSchoolId`, transfer from/to) tetap berlaku tanpa perubahan relasi, dan transfer gudang→sekolah otomatis memakai mesin transfer yang ada.
- `purchase_orders.targetSchoolId` diisi server-side = ID gudang; field form dihapus; request dengan tujuan non-gudang ditolak.

### D2. Peran: tambah `warehouse_admin` + `school_admin`, pertahankan dua lama
`users.role` menjadi `central_admin | warehouse_admin | school_admin | branch_admin`. `branch_admin` dipertahankan sementara sebagai alias perilaku `school_admin` agar akun demo lama tidak rusak; seed menambah akun admin gudang. Pola `DashboardActor` di `dashboard-summary.ts` digeneralisasi menjadi helper `resolveActor` + `scopeByLocation` yang dipakai semua route (menutup lubang isolasi di `procurement.ts` dkk).

### D3. Diskon persen per item, tiga angka di header
`purchase_order_items.discount_percent` (integer 0–100); netto per item dihitung, tiga angka header (`subtotal_gross`, `discount_total`, `total_net`) disimpan di `purchase_orders` saat create/update agar daftar PO tidak perlu join agregat. Alternatif hitung on-the-fly ditolak untuk list karena N+1 query per PO.

### D4. Harga paket = derived, disimpan dengan penanda
`bookPackages.price` tetap disimpan (menghindari join mahal di semua daftar) tetapi diperlakukan sebagai cache: dihitung ulang dari `SUM(harga jual * qty)` setiap kali komponen paket atau harga jual buku berubah (service `recalcPackagePrice`, dipakai juga oleh endpoint paket). `books` mendapat `buy_price` + `sell_price`; `price` lama dipertahankan sementara sebagai fallback baca (diperlakukan sebagai kedua harga bila yang baru null) lalu dihapus pada change berikutnya.

### D5. Summary di UI + agregasi di API, fisik tetap di DB
Endpoint agregat baru (`GET /book-items/summary`, `GET /packages/summary`, ringkasan dashboard diperluas) dengan `GROUP BY book/school`; UI utama hanya memakai endpoint summary. Transaksi qty → service `allocateStock(fifo)` memilih eksemplar fisik di server. Drill-down fisik hanya untuk peran gudang/central (audit), bukan alur utama. Alternatif hapus tracking fisik ditolak karena retur cacat dan audit butuh identitas eksemplar.

### D6. State machine PO diperluas, gerbang kirim di server
`draft → printed → signed_uploaded → sent → partially_received → received`. Aksi `send` menolak bila berkas bukti belum ada (validasi server, bukan sekadar disable tombol). Berkas via storage abstraction yang sama dengan bukti pembayaran (R2 di Workers, lokal/S3 di VPS) dengan kolom `signed_doc_url` (+ metadata) di `purchase_orders`. PO lama tanpa bukti tetap valid (pemeriksaan hanya untuk PO yang melewati status baru).

### D7. Cut-off satuan per tahun ajaran di `system_settings`
Kunci `satuan_open_from:<tahunAjaran>` (tanggal ISO) + `satuan_override:<tahunAjaran>` (`open|closed|absent`). Evaluasi: override bila ada → tanggal (banding dalam zona `Asia/Jakarta`, dihitung eksplisit dari UTC, bukan zona server) → default tertutup. Default-tertutup membuat rollover Agustus otomatis aman.

### D8. Laporan penjualan sebagai query agregat tanpa tabel baru
Agregat atas `student_book_orders` + `order_payments` dengan filter periode/sekolah/tipe, scope isolasi yang sama dengan D2, ekspor CSV dari shape yang sama dengan respons JSON. Ditandai eksplisit sebagai asumsi sementara.

## Risks / Trade-offs

- [Risk] `procurement.ts` dan route lain tanpa scoping aktor → data bocor antar sekolah → Mitigasi: fase 1 tasks adalah audit + helper isolasi sebelum fitur lain; tambah regression test per route.
- [Risk] Perbandingan tanggal WIB salah bila memakai zona server (Workers = UTC) → Mitigasi: util `todayWIB()` tunggal + unit test batas hari.
- [Risk] Harga paket cache basi bila ada jalur ubah harga yang lupa memanggil recalc → Mitigasi: satu service tulis harga buku yang selalu memicu recalc; test integrasi paket-ikut-berubah.
- [Risk] Auto-alokasi FIFO salah pilih saat stok kondisi campur → Mitigasi: alokasi hanya dari kondisi `new/good` untuk serah terima; kondisi eksplisit di spec transaksi.
- [Risk] File >400 baris saat menambah endpoint summary/laporan → Mitigasi: service baru di `src/server/services/`, route tetap tipis (sesuai AGENTS.md).
- [Trade-off] Tiga angka total PO disimpan (denormalisasi) → perlu disiplin update; dipilih demi performa list.

## Migration Plan

1. Migrasi skema (kolom baru nullable/default aman) → `db:push` lokal + `db:generate` + eksekusi SQL ke D1 remote + verifikasi `PRAGMA table_info`.
2. Seed: baris gudang + akun admin gudang; data lama: `targetSchoolId` PO lama dibiarkan; buku lama fallback harga.
3. Deploy: backend dulu (endpoint baru backward-compatible), frontend kemudian; rollback = revert worker ke build sebelumnya (skema aditif, aman).
4. Urutan fase: (1) gudang+isolasi+seed, (2) harga+diskon, (3) PO workflow+supplier UI, (4) summary stok+transfer, (5) portal satuan+cut-off, (6) laporan.

## Open Questions

- Bentuk final laporan penjualan menunggu detail user (asumsi tercatat di `specs/sales-report/spec.md`).
- Apakah `branch_admin` pada akhirnya dihapus atau dipertahankan permanen sebagai alias (keputusan saat implementasi fase 1, tidak mengubah spec).
- Aturan kondisi stok untuk auto-alokasi serah terima bila user meminta variasi (default `new/good`).
