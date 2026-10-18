# Struk bank adalah identitas pembayaran

Satu bukti transfer bank dicatat sekali sebagai **Struk Bayar** milik murid, lalu dipecah menjadi **Alokasi** ke satu atau beberapa order lintas jenis barang (buku dan seragam). Identitas struk adalah pasangan (bank, nomor referensi), dijaga oleh constraint unik di database. Pembayaran tidak lagi disimpan sebagai baris milik satu order di dua tabel terpisah.

## Considered Options

- Baris pembayaran per order seperti sekarang (ditolak: satu struk yang menutup order buku dan seragam harus dipecah manual ke dua tabel, dan bukti yang sama dapat dihitung dua kali karena tidak ada identitas struk).
- Struk + alokasi (dipilih: uang masuk dan pembagiannya adalah dua fakta berbeda; memisahkannya membuat total uang masuk dapat dihitung tanpa double-count dan duplikasi bukti tertolak di level database).
- Ledger per murid tanpa entitas struk (ditolak: kehilangan kemampuan menolak bukti ganda dan menautkan bukti ke bank statement).

## Consequences

Nomor referensi boleh kosong; SQLite mengizinkan banyak NULL pada constraint unik sehingga struk tanpa nomor referensi tetap sah. Alokasi tidak boleh melebihi nominal struk, dan sisa yang belum dialokasikan harus terlihat agar finance cabang tahu apa yang belum dibagi. Verifikasi dan penolakan beroperasi pada struk, bukan pada order, sehingga satu penolakan tidak memaksa unggah ulang per order. Tabel `order_payments` dan `uniform_payments` dihapus setelah backfill — tidak boleh ada dua implementasi pembayaran paralel.
