# Tasks

## 1. Database Schema & Migration for Term Reconciliation

- [x] 1.1 Tambahkan skema tabel `term_reconciliations` dan `term_reconciliation_items` di `src/db/schema.ts` lengkap dengan relasi dan indeks pencarian.
- [x] 1.2 Generate migrasi SQL lokal (`bun run db:generate`) dan terapkan ke database SQLite lokal via `bun run db:push`.
- [x] 1.3 Verifikasi skema dengan `bun run check:all` untuk memastikan tidak ada celah tipe atau pelanggaran D1 error handling.

## 2. Backend Services & API Routes

- [x] 2.1 Implementasikan service kalkulasi kuota siswa aktif (Cap Max) per cabang dan per jenjang di `src/server/services/push-distribution.ts`.
- [x] 2.2 Buat endpoint API pengiriman push distribution langsung dari Gudang Pusat ke Cabang tanpa mensyaratkan PO internal di `src/server/routes/push-distribution.ts`.
- [x] 2.3 Implementasikan service rekonsiliasi akhir periode di `src/server/services/term-reconciliation.ts` untuk mengompilasi data inbound, log penyerahan siswa, kalkulasi sisa sistem, dan pendeteksian selisih hilang.
- [x] 2.4 Buat route API rekonsiliasi akhir periode di `src/server/routes/term-reconciliation.ts` (buka audit, simpan draft fisik, finalisasi, dan generate nomor Berita Acara & Memo Tagihan).
- [x] 2.5 Tambahkan unit test dan integration test untuk rute push distribution dan rekonsiliasi periode di `src/server/routes/*.test.ts`.

## 3. Printable Berita Acara & Tagihan Selisih (Loss Billing Memo)

- [x] 3.1 Implementasikan endpoint / helper pembentuk dokumen Berita Acara Rekonsiliasi lengkap dengan data valuasi buku hilang berbasis harga jual resmi.
- [x] 3.2 Implementasikan helper/service rekapitulasi data serah terima siswa (nama siswa, NIS, kelas, tanggal serah terima, paket buku) sebagai lampiran resmi penagihan.

## 4. Frontend Views & User Experience

- [x] 4.1 Buat antarmuka *Push Distribution Wizard* untuk Gudang Pusat: visualisasi kuota siswa per jenjang, rekomendasi alokasi buku, dan tombol konfirmasi pengiriman bulk.
- [x] 4.2 Buat halaman *Audit Rekonsiliasi Akhir Periode* untuk tim Logistik & Cabang: tabel komparasi otomatis (Inbound vs Serah Terima vs Fisik Rak), penanda selisih warna/indikator.
- [x] 4.3 Buat komponen tampilan cetak (Print View) Berita Acara Rekonsiliasi dan Nota Tagihan ke Finance Cabang yang siap cetak / simpan ke PDF.
- [x] 4.4 Sediakan tombol aksi cepat "Tarik Sisa Fisik ke Gudang Pusat" dan integrasikan dengan opsi pembongkaran paket (*unbundling*) di inventaris Gudang Pusat.

## 5. Verification & Quality Gates

- [x] 5.1 Jalankan `bun run type-check` dan pastikan 0 error TypeScript.
- [x] 5.2 Jalankan `bun test` untuk memastikan semua skenario pengujian hijau.
- [x] 5.3 Jalankan linting dan file-size gate `bun run check:all` untuk memastikan seluruh pedoman AGENTS.md terpenuhi.
