# Ambil-langsung v1, tanpa delivery ke alamat

Distribusi ke siswa adalah serah-terima langsung di sekolah (`handoverDeliveryNumber` `SJ-SERAH-*`, `fulfillmentStatus` → `picked_up`). Tidak ada kolom alamat di siswa/pesanan, tidak ada kurir/ongkir/pelacakan. Langkah 12 flowchart ("kirim sesuai alamat siswa") dinyatakan di luar scope v1.

## Considered Options

- Tambah alamat + kurir sekarang vs tunda (dipilih: tunda — ongkir, pilihan kurir, dan tracking adalah scope besar dengan kebutuhan bisnis yang belum diputuskan).

## Consequences

Jika bisnis membutuhkan delivery, ajukan ADR baru (model alamat, tarif, pihak kurir) — bukan tambalan di handover yang ada. Laporan dan refund tidak berubah.
