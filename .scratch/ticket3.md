## What to build

Mengunci keputusan arsitektur sistem bahwa alur portal pemesanan buku berfungsi sebagai self-service confirmation & reconciliation ledger (bukan gerbang validasi kasir yang memblokir penyerahan fisik).

## Acceptance criteria

- [ ] Dokumen `docs/adr/0018-rekonsiliasi-pengambilan-buku-portal.md` tercatat resmi.
- [ ] `GLOSSARY.md` diperbarui dengan definisi terbaru Bukti Pengambilan dan peran Rekonsiliasi Gudang.
- [ ] Verifikasi seluruh gate pre-commit / `bun run check:fast` hijau tanpa smell/drift.

## Blocked by

- #243
- #244
