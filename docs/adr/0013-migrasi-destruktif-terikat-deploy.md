# Migrasi destruktif terikat deploy, bukan commit

Migrasi yang **menghapus** kolom atau tabel tidak boleh mendarat di commit/PR yang sama dengan kode yang berhenti memakainya. Urutannya wajib dua langkah: **expand** (kode baru ditulis tanpa memakai objek lama, objek lama dibiarkan) → deploy → **contract** (drop objek lama di PR terpisah). Migrasi **aditif** (tambah tabel/kolom/index) tetap boleh diterapkan sebelum merge seperti aturan biasa.

Alasannya: kode dan skema tidak dideploy bersama. Applying migrasi ke remote D1 mendahului deploy Worker, jadi ada jendela di mana Worker produksi lama masih meng-query objek yang sudah hilang.

## Considered Options

- Drop di PR yang sama (ditolak: **insiden 18 Okt 2026** — `drizzle/0031` men-drop `order_payments`/`uniform_payments` ke D1 remote sebelum PR-nya merge, sementara Worker produksi masih membaca kedua tabel itu; seluruh alur pembayaran wali murid 500 `no such table` sampai deploy manual dijalankan).
- Expand dan contract dalam dua PR (dipilih: satu-satunya urutan yang tidak punya jendela rusak; PR contract tidak bisa merge sebelum PR expand ter-deploy).
- Rollback skema saat terlanjur tidak sinkron (ditolak: berarti menyusun ulang tabel uang dari tabel penggantinya lewat tulisan tangan pada data finansial produksi — jauh lebih berisiko daripada mempercepat deploy).

## Consequences

PR yang men-drop objek wajib menyebutnya di deskripsi dan menunggu deploy PR expand, bukan sekadar CI hijau. Repo ini **tidak** memakai bookkeeping migrasi otomatis: `bun run db:d1:migrate` (`wrangler d1 migrations apply`) gagal jalan karena `migrations_dir` tidak diset dan folder `migrations/` tidak ada, jadi seluruh migrasi diterapkan manual lewat `wrangler d1 execute --file` dan tidak ada tabel `d1_migrations` yang mencegah penerapan ganda — destruktif yang diterapkan dua kali akan gagal, bukan diam-diam merusak. Memperbaiki ketidaksinkronan skema-vs-kode adalah **deploy kode**, bukan rollback skema. `check:d1-drift` hanya mendeteksi objek yang **hilang** dari remote, jadi ia tidak menangkap kelas cacat ini: skema sudah "benar" sementara kode produksi tertinggal.
