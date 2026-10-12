# Pengiriman-rumah khusus seragam (pengecualian ADR-0004)

Order seragam membawa snapshot alamat rumah (`homeAddressSnapshot`) dan status kirim dua-state (`belum_dikirim` → `sudah_dikirim` + `shippedAt`) yang dicentang manual oleh `warehouse_admin`/`central_admin`. Tanpa tabel kurir, ongkir, resi, atau pelacakan. Buku tetap `Ambil Langsung` (`SJ-SERAH-*`); istilah `Surat Jalan Serah-Terima` tidak dipakai untuk seragam.

## Considered Options

- Paksa ambil-langsung untuk seragam vs kirim-rumah (dipilih: kirim-rumah — request eksplisit seragam dikirim ke alamat rumah masing-masing).
- Flag manual dua-state vs kelola kurir penuh (dipilih: flag manual — "ga perlu manage kurir", cukup tahu mana sudah/belum terkirim).

## Consequences

Alamat adalah snapshot per order (bisa beda antar transaksi murid yang sama). Satu order = satu murid sehingga satu flag = satu kiriman. Jika bisnis kelak butuh kurir/ongkir, ajukan ADR baru — bukan tambalan di flag ini.
