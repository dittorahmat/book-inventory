# Pengiriman bukan master data

Pengiriman bersifat **transaksional per order**, bukan salah satu master data. Alamat rumah disimpan sebagai snapshot di order (`homeAddressSnapshot`), begitu pula ongkir (`shippingCost`), resi (`shippingResi`), dan status kirim dua-state. Master data yang sah hanya daftar ekspedisi — dan, bila kelak diputuskan, tabel tarif ongkir per zona.

## Considered Options

- Tabel master pengiriman berisi alamat murid (ditolak: histori order ikut berubah saat wali pindah rumah, sehingga tagihan lama tidak bisa direproduksi; sekaligus mengundang penyimpanan data pribadi yang berlipat).
- Snapshot per order (dipilih: satu order merekam alamat saat transaksi terjadi; order lama tetap sah walaupun keluarganya pindah).
- Master kurir penuh dengan tarif dan pelacakan (ditolak untuk v1: lihat ADR-0006 — "ga perlu manage kurir", cukup tahu mana sudah/belum terkirim).

## Consequences

Satu order = satu kiriman, jadi satu flag sudah cukup. Kalau kelak buku **dan** seragam dikirim terpisah untuk satu order, ongkir tidak bisa lagi menempel di order — ia harus menempel pada kiriman, dan itu berarti model kiriman tersendiri sebagai ADR baru, bukan tambahan kolom di order. Rujuk ADR-0004 (paket buku ambil langsung, tanpa alamat) dan ADR-0006 (pengiriman rumah khusus seragam) yang tetap berlaku.
