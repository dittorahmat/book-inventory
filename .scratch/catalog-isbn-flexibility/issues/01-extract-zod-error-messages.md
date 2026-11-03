# 01: Ekstraksi Pesan Validasi Zod Ramah Pengguna di Klien API

**What to build:**
Ketika server mengembalikan error validasi Zod (format payload `{ success: false, error: { issues: [...] } }`), klien API (`readJson` di `src/lib/api.ts`) harus mengekstrak pesan validasi menjadi teks kalimat yang ramah dan terbaca pengguna (misal: "isbn: Valid ISBN required"), bukan membiarkannya dievaluasi menjadi string default JavaScript "[object Object]". Berlaku secara global untuk seluruh pemanggilan API di aplikasi.

**Blocked by:** None (can start immediately)

**Status:** in-progress

- [ ] `readJson` di `src/lib/api.ts` menangani properti `data.error` baik berupa string maupun objek berstruktur Zod `{ issues: [...] }`
- [ ] Format pesan error yang dihasilkan informatif dan menggabungkan issue Zod yang ada
- [ ] Unit regression test di `src/lib/api.test.ts` memverifikasi bahwa error response berstruktur Zod menghasilkan pesan terbaca
