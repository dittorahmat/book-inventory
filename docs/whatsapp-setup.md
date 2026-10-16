# Panduan Setup WhatsApp (Invoice + Notifikasi)

Sistem memakai dua jalur WhatsApp. Untuk **invoice satuan + link pembayaran** dipakai
**Meta Official (Cloud API)** — ini yang wajib disetup. Gateway lama (sidecar) tetap
bisa dipakai untuk notifikasi umum bila sudah ada.

## 1. Ringkasan pilihan

| Jalur | Dipakai untuk | Config di app |
|---|---|---|
| Meta Official (Cloud API) | Invoice WA + link bayar satuan (buku & seragam) | Settings → WhatsApp → bagian Meta |
| Sidecar gateway (Baileys/WPPConnect/Fonnte) | Notifikasi order publik (opsional, legacy) | Settings → WhatsApp → bagian gateway |

## 2. Mendapatkan akses Meta Cloud API

1. Buat/buka akun di [Meta for Developers](https://developers.facebook.com/) (login Facebook).
2. **Create App** → pilih tipe **Business** → isi nama app + email.
3. Di dashboard app: **Add Product** → **WhatsApp** → **Set up**.
4. Masuk menu **WhatsApp → API Setup**:
   - Pilih/catat **Phone number** uji coba yang disediakan Meta (diawali 1555...).
   - Salin **Phone Number ID** (bukan nomornya) → ini diinput ke `Phone Number ID` di app.
   - Salin **Temporary Access Token** (berlaku ±24 jam, cukup untuk uji coba).
5. Daftarkan nomor WA penerima uji di **To** (verifikasi via kode OTP), lalu tes kirim
   dari app: Settings → WhatsApp → Meta → **Uji Kirim**.

## 3. Token permanen (produksi)

Token sementara kedaluwarsa 24 jam. Untuk produksi buat **System User token**:

1. Buka [Meta Business Settings](https://business.facebook.com/settings/) → pilih bisnis.
2. **Users → System Users** → **Add** → beri nama mis. `invoice-sender` → role **Employee**.
3. **Add Assets** → pilih app WhatsApp → aktifkan permission
   `whatsapp_business_messaging` (+ `whatsapp_business_management` bila perlu).
4. **Generate New Token** → pilih app → centang permission di atas → salin token.
5. Tempel ke `Access Token` di app, aktifkan toggle, **Uji Kirim** sekali lagi.

> Jaga token seperti password. Kalau bocor: revoke dari Business Settings → generate ulang.

## 4. Nomor produksi (mengirim ke ortu asli)

1. Di **WhatsApp → API Setup** klik **Add phone number** → ikuti verifikasi
   (OTP via SMS/telp) untuk nomor milik yayasan.
2. Nomor uji coba Meta hanya bisa kirim ke ≤5 nomor terdaftar; nomor produksi
   tidak punya batas ini.
3. Untuk volume besar / nama tampil resmi: lengkapi **verifikasi bisnis**
   (Business verification) + **Display Name** review di
   **WhatsApp Manager** ([business.facebook.com](https://business.facebook.com/) → All tools → WhatsApp Manager).

## 5. Template pesan (penting untuk produksi)

Meta hanya mengizinkan pesan **template** untuk chat yang dimulai bisnis di luar
jendela 24 jam. Invoice kita dikirim sebagai teks bebas (`text` + `preview_url`):
itu lolos bila ortu pernah chat ≤24 jam terakhir, **ditolak** (`#131047`) bila tidak.

Rekomendasi produksi:

1. Di **WhatsApp Manager → Message Templates** buat template kategori **UTILITY**,
   contoh nama `invoice_tagihan`, bahasa `id`, isi dengan variabel:
   `Halo {{1}}, tagihan {{2}} untuk ananda {{3}} total {{4}}. Link bayar: {{5}}`
2. Submit → tunggu status **Approved** (biasanya <1 jam).
3. Minta developer mengganti pengiriman teks bebas menjadi pemanggilan template
   tersebut (kode saat ini memakai `type: text`; adaptor template belum tersedia).

Selama template belum dipakai: kirim invoice **di jam kerja** setelah ortu
menghubungi duluan, atau minta ortu balas "YA" sekali agar jendela 24 jam terbuka.

## 6. Isi config di aplikasi

Buka **Settings → tab WhatsApp** (hanya central admin):

- Centang **Aktifkan kirim invoice via Meta**.
- `Phone Number ID`: dari API Setup (hanya angka ID, bukan nomor telepon).
- `Access Token`: token sementara (uji) atau System User token (produksi).
- Klik **Simpan Meta** → isi nomor uji → **Uji Kirim**.
- Hasil `simulated` = config belum lengkap/nonaktif (pesan tidak benar-benar terkirim,
  tapi alur invoice tetap jalan agar operasional tidak macet).

## 7. Format nomor & link bayar

- Nomor ortu dinormalisasi otomatis `08xx → 628xx` oleh backend.
- Link bayar di pesan berbentuk `https://domain/bayar/buku/:token` dan
  `https://domain/bayar/seragam/:token` — pastikan domain produksi bisa diakses
  ortu (HTTPS) karena `preview_url` butuh URL publik.

## 8. Troubleshooting

| Gejala | Penyebab umum | Aksi |
|---|---|---|
| Uji kirim `simulated` | Toggle mati / Phone ID / token kosong | Lengkapi + simpan, uji ulang |
| `401 / invalid token` | Token kedaluwarsa/direvoke | Generate token baru (§3) |
| `404 phone number` | Salah Phone Number ID | Salin ulang ID dari API Setup, bukan nomornya |
| `#131047` template | Di luar jendela 24 jam tanpa template | Lihat §5 |
| `#132000` | Nomor penerima salah format | Pastikan format `628xx`, tanpa `+`/spasi |
| Invoice 400 "Input ongkir" | Aturan alur, bukan error WA | Input ongkir gudang dulu baru kirim invoice |
| Timeout >8s | Jaringan ke graph.facebook.com | Ulangi; cek egress Cloudflare Worker |

## 9. Biaya

Meta menagih per **percakapan** (bukan per pesan), tarif per negara/kategori
(marketing/utility/auth). Cek tarif terbaru di
[dokumentasi pricing Meta](https://developers.facebook.com/docs/whatsapp/pricing/).
1000 nomor uji coba pertama per bulan biasanya gratis (free tier) — verifikasi
di WhatsApp Manager → Billing.
