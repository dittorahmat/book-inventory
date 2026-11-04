# 01: Core Parsing Multi-Sheet, Header Fleksibel, & Auto-Tagging Penerbit

**What to build:**
Perluasan parser `book-import-parser.ts` agar dapat mengekstrak data dari seluruh sheet kelas numerik ('1'..'6') pada workbook Excel resmi Al-Wildan, memetakan header bertipe `Harga/Unit (Rp)` dan `NAMA BUKU`, mengabaikan sheet/baris rekapitulasi (#REF!), serta menerapkan inferensi otomatis penerbit (Cambridge vs Al-Wildan Press) dan semester.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Header `Harga/Unit (Rp)` dan variasi newline/spasi terpetakan ke `price` secara akurat (bukan 0)
- [x] Multi-sheet numerik ('1'..'6') dibaca berurutan dan sheet rekapitulasi diabaikan
- [x] Auto-tagging penerbit Cambridge vs Al-Wildan Press berjalan sesuai judul buku
- [x] Unit test parser lulus 100%

