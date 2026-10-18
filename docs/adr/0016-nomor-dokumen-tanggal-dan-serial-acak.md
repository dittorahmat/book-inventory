# Nomor dokumen = prefix + tanggal + serial acak

Semua nomor dokumen dibangkitkan `documentNumber(prefix, epochTimeFragment(now, n), randomSerial(6))` — mis. `TGH-20261018-4F7A2C`, `CLM-202610-9B31D0`. **Tidak ada** urutan sekuensial per periode seperti `SRG-2026-00001`.

## Considered Options

- Sekuensial per periode (ditolak: butuh counter atomik, artinya satu titik serialisasi di D1 untuk setiap dokumen; menambah test konkurensi, dan manfaatnya hanya estetika — "dokumen ke-berapa bulan ini" tidak dipakai laporan mana pun).
- Tanggal + serial acak (dipilih: tetap unik, tetap urut secara leksikografis per tanggal, tanpa kontensi).
- UUID polos (ditolak: tidak terbaca manusia saat staf mencocokkan di telepon).

## Consequences

Nomor tidak memberi tahu posisi urut dalam periode. Kalau audit kelak membutuhkannya, tambahkan **kolom urut terpisah** (mis. nomor urut cetak), jangan ganti format nomornya — nomor sudah tercetak di surat jalan dan tersebar di percakapan WhatsApp. Setiap prefix baru wajib terdaftar di `GENERATED_COLUMNS` pada `scripts/check-doc-number-uniqueness.ts` beserta kolom targetnya, dan kolom itu wajib ber-`UNIQUE` (atau didaftarkan sengaja dengan alasan) — gate akan merah sampai pemiliknya memutuskan.
