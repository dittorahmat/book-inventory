# SJ dua lapis: administratif internal vs gerakan fisik transfer

`internal_shipments` adalah catatan administratif (nomor Surat Jalan Internal, tanggal kirim) dan tidak menyentuh `book_items`/`package_items`. Gerakan fisik stok hanya lewat `transfer_shipments` (dispatch → receive, relokasi `currentSchoolId`). Keduanya ditautkan lewat referensi nullable dari pengiriman internal ke gerakan fisik agar audit tetap closed-loop tanpa menggabung dua tanggung jawab berbeda.

## Considered Options

- Gabung jadi satu tabel pengiriman vs pertahankan dua lapis (dipilih: dua lapis — pengiriman internal mendukung multi-delivery parsial per PO, transfer mendukung kondisi per eksemplar).
- Tabel mapping many-to-many vs satu referensi nullable (dipilih: nullable — satu SJ internal umumnya satu gerakan fisik; YAGNI).

## Consequences

Penerimaan cabang (`receivedDate/receivedBy`, `delivered`/`discrepancy`) tinggal di lapis internal; kondisi per eksemplar + mutasi stok tinggal di lapis transfer. UI wajib menampilkan keduanya berdampingan.
