# Pembayar dokumen tagihan adalah cabang, bukan wali murid

Wali murid membayar ke virtual account murid di cabang, bukan ke aplikasi. Karena itu dokumen tagihan yang dihasilkan sistem adalah tagihan **gudang → cabang**: kewajiban cabang membayar barang yang sudah dikirim atau diserahkan, dengan struk transfer wali sebagai bukti bahwa cabang sudah memegang uangnya. Invoice yang dikirim ke wali lewat WhatsApp tetap ada sebagai pemberitahuan jumlah dan kanal pembayaran, tetapi ia bukan dokumen rekonsiliasi.

## Considered Options

- Tagihan gudang → cabang (dipilih: sesuai kenyataan pembayaran — uang masuk ke rekening cabang, jadi yang punya kewajiban adalah cabang).
- Tagihan langsung ke wali sebagai dokumen rekonsiliasi (ditolak: aplikasi tidak pernah menerima uang; menandai wali sebagai pembayar membuat rekonsiliasi mengklaim sesuatu yang tidak terjadi).

## Consequences

Satu struk transfer dapat menutup beberapa kewajiban sekaligus (buku, SPP, uang gedung). Pembagian di luar buku adalah wewenang finance cabang dan tidak dicatat aplikasi — aplikasi hanya menyimpan porsi yang dialokasikan ke order buku/seragam. Verifikasi struk oleh gudang berarti "cabang sudah menerima uang", bukan "wali sudah membayar ke kami". Karena itu status pembayaran order dan status tagihan cabang adalah dua hal berbeda dan tidak boleh disatukan dalam satu kolom.
