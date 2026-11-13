## What to build

Menyediakan agregasi dan breakdown status pemenuhan dan distribusi (pesanan lunas/belum lunas, serah terima paket buku, dan pengiriman paket seragam) yang dapat dikelompokkan berdasarkan ruang kelas fisik (`rombel`). Staf pimpinan dan operasional sekolah dapat meninjau progres distribusi buku dan seragam per ruangan kelas (misal kelas `"1 INTER 1"`, `"1 MQ 1"`, dsb.) melalui drawer/modal dashboard serta mengekspor laporannya ke berkas spreadsheet.

Sesuai ADR 0023.

## Acceptance criteria

- [ ] Endpoint laporan/dashboard (`/api/dashboard/...` atau reporting service) mendukung query breakdown metrik siswa/pesanan buku & seragam yang dikelompokkan per `rombel`.
- [ ] Komponen breakdown dashboard (`StudentBreakdownDrawer.tsx` / `ExecutiveDashboard.tsx`) menyajikan tab atau accordion per ruang kelas siswa.
- [ ] Fitur ekspor CSV / Excel laporan pemenuhan distribusi menyertakan kolom ruang kelas/rombel.
- [ ] Unit & route test reporting memverifikasi keakuratan agregat per ruang kelas.
- [ ] `bun run check:fast` dan `bun run check:all` lulus bersih.

## Blocked by

- #446 (feat(students): filter rombel & tampilan ruang kelas pada antarmuka murid dan kasir)
