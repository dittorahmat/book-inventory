## Ringkasan Perubahan

Menuntaskan kendala pada lingkungan Cloudflare Worker (`worker.dev`), sinkronisasi skema remote D1, penegakan isolasi role cabang, serta implementasi fail-fast interceptor untuk otomasi demo.

1. **Resolusi D1 Remote Drift (HTTP 400 & 500)**:
   - Mengaplikasikan migrasi remote D1 yang tertinggal (`0038`, `0039`, `0040`, `0041`), memulihkan tabel `refund_slips`, kolom `kind` di `book_returns`, dan tracking resi pada seragam.
   - Hasil `bun run check:d1-drift` terverifikasi sinkron penuh (49 tabel cocok).

2. **Perbaikan Review & Otomasi Demo (PR Review Axis)**:
   - Menghilangkan *silent-catch* pada sinkronisasi skema lokal `check-changed.ts` dan menegakkan flag `db:push:bun --all`.
   - Mengubah `attachErrorFailFast` agar beroperasi secara *true fail-fast* (`immediateThrow: true`) dan dipasang di tingkat `BrowserContext` sehingga mencakup seluruh tab/popups.
   - Mengganti array string mentah dengan objek error terstruktur `InterceptedError`.

3. **Retrospektif & Anti-Drift Guard**:
   - Menambahkan script `"deploy": "bun run check:d1-drift && wrangler deploy"` di `package.json` agar verifikasi drift selalu dieksekusi sebelum deployment worker.
   - Memperbarui panduan anti-kambuh di `AGENTS.md` (§0.30 & §0.43).

## Perubahan Perilaku
- Eksekusi script otomasi demo akan langsung berhenti fail-fast seketika terdeteksi error server HTTP >= 500 atau unhandled JavaScript crash.
- `check-changed` tidak lagi mentoleransi kegagalan sinkronisasi skema lokal SQLite.
- Perintah deploy worker otomatis mengecek status drift D1.

## Checklist Kualitas
- [x] `bun run check:fast` hijau (0 errors)
- [x] `bun run type-check` nol error
- [x] `bun run check:d1-drift` 49 tabel cocok
