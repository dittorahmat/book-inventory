# Portal wali murid tanpa akun

Wali murid **tidak** punya akun, password, atau OTP. Identitas ditentukan saat pemesanan lewat pencarian nama/NIS yang terpartisi sekolah, dan status pembayaran diakses lewat tautan bertoken (`/bayar/buku/:token`, `/bayar/seragam/:token`) yang dikirim gudang via WhatsApp.

## Considered Options

- Akun + password untuk wali (ditolak: ribuan wali × reset password × OTP berbayar × meja bantuan, tanpa manfaat yang tidak bisa diberikan tautan; satu-satunya kebutuhan nyata — riwayat pesanan — bisa dipenuhi tautan).
- Magic link per murid sebagai identitas (dipilih sebagai pengganti bila riwayat lintas tahun dibutuhkan: token yang sama dengan tautan pembayaran, bukan kredensial).
- Tanpa akun, identitas lewat pencarian siswa (dipilih).

## Consequences

Status pembayaran hanya terlihat oleh pemegang tautan; kalau tautan hilang, gudang mengirim ulang, bukan memulihkan password. Karena identitas bergantung pada data yang diinput sendiri (nama/NIS), siswa baru berstatus `new_pending` wajib diverifikasi admin sekolah sebelum boleh melanjutkan pemesanan — itulah pengganti verifikasi identitas yang biasanya datang dari akun. Menambahkan akun wali kelak bukan penyempurnaan kecil: ia membawa kewajiban menyimpan kredensial dan menambah permukaan data pribadi, jadi wajib ADR baru beserta keputusan pemilik data.
