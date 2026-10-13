# Kirim-rumah khusus buku satuan (pengecualian ADR-0004, cermin ADR-0006)

Order buku yang memuat baris satuan (`student_order_items`) membawa snapshot alamat rumah (`home_address_snapshot`) dan status kirim dua-state (`belum_dikirim` → `sudah_dikirim` + `satuan_shipped_at`) yang dicentang manual oleh `warehouse_admin`/`central_admin`. Tanpa tabel kurir, ongkir, resi, atau pelacakan. Paket (`packageId`) tetap `Ambil Langsung` (`SJ-SERAH-*`); istilah `Surat Jalan Serah-Terima` tidak dipakai untuk satuan kirim-rumah. Order campur paket+satuan memakai dua flag independen (handover paket vs kiriman satuan) agar tidak deadlock.

## Considered Options

- Paksa ambil-langsung untuk satuan vs kirim-rumah (dipilih: kirim-rumah — flowchart langkah 12 khusus satuan, paket tetap diambil sendiri).
- Satu status gabungan vs dua flag (dipilih: dua flag — paket siap dan satuan terkirim punya ritme berbeda).
- Kelola kurir penuh vs flag manual (dipilih: flag manual — cermin seragam, cukup tahu mana sudah/belum terkirim).

## Consequences

Alamat adalah snapshot per order. Validasi `homeAddress` wajib saat submit satuan ditolak 400 tanpa alamat. `markSatuanShipped` satu arah; paket murni dan order tanpa alamat ditolak 400. Jika bisnis kelak butuh kurir/ongkir, ajukan ADR baru — bukan tambalan di flag ini.
