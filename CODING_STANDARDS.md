# Coding Standards — Review Checklist

Berkas ini dibaca **saat review**, bukan saat implementasi. `AGENTS.md` memuat
aturan yang mengarahkan implementasi; berkas ini memuat rincian yang hanya
dibutuhkan reviewer: katalog gate, smell baseline, checklist UI, dan rasional
insiden. Bila keduanya bertentangan, `AGENTS.md` menang (ia yang dilihat agen
implementasi).

## 1. Katalog gate

Sumber kebenaran urutan gate adalah `check:all` di `package.json` dan
`.github/workflows/checks.yml` — jangan disalin ke dokumen. Yang perlu reviewer
ketahui adalah **apa yang dijamin tiap gate**:

| Gate | Menjamin |
|---|---|
| `type-check` | `tsc --noEmit` nol error; `AppDatabase` schema-aware, biarkan inferensi (jangan anotasi `$inferSelect` manual pada JOIN) |
| `lint` | eslint seluruh repo |
| `check:file-size` | file `src/**/*.ts(x)` ≤ 400 baris (kecuali test, `schema.ts`, `seed.ts`, `*.d.ts`); default diff-scoped, `--all` di CI |
| `check:imports` | import relatif keluar `src/` atau target tak ada |
| `check:api-contract` | literal `/api/...` klien cocok route terdaftar; portal publik hanya `/api/public/*` |
| `check:route-tests` | setiap file route punya `*.test.ts` |
| `check:validators` | identifier entity memakai `idSchema`, bukan `z.string().uuid()` |
| `check:dead` | export tanpa perujuk |
| `check:no-any` | `any` baru pada baris diff |
| `check:canonical-helpers` | salinan lokal helper/tipe yang sudah punya pemilik kanonik |
| `check:d1-writes` | §10.1 chunk ≤10 baris dan §10.2 larangan `Promise.all` tulis |
| `check:d1-error-mapping` | setiap `runWriteBatch()` memetakan constraint lewat `d1WriteErrorStatus()` |
| `check:test-isolation` | test tidak menyentuh D1/Miniflare; preload `test/setup.ts` utuh |
| `check:doc-numbers` | kolom nomor dokumen hasil `documentNumber()` wajib UNIQUE |
| `check:lanes` | union allowlist lane manifest mencakup semua file berubah (self-skip tanpa manifest) |
| `check:plans` | setiap query partisi `SEARCH USING INDEX`, kolom partisi berindeks pendahulu, baca list ber-`LIMIT` |
| `build` | Vite + bundel server/worker kompilasi bersih |
| `bun test` | suite di DB sementara terisolasi |

Gate diff-scoped (`check:file-size`, `check:no-any`, `check:canonical-helpers`)
tidak vakum di CI karena mendiff `GATE_BASE_REF`; sisanya memindai seluruh pohon.

## 2. Smell baseline yang wajib dicek reviewer

Selain aturan repo, periksa 12 smell Fowler ini dan beri label sebagai
**judgement call**, bukan pelanggaran keras:

Mysterious Name · Duplicated Code · Feature Envy · Data Clumps · Primitive
Obsession · Repeated Switches · Shotgun Surgery · Divergent Change ·
Speculative Generality · Message Chains · Middle Man · Refused Bequest.

Aturan repo mengalahkan baseline. Contoh yang sering muncul di repo ini:
guard/loop verbose yang setara `map`/`filter`/`??`/ternary satu baris;
helper harga/fetch/rupiah duplikat; factory yang hanya dipakai sekali.

## 3. Checklist UI (anti-slop)

- Dilarang AI-purple/blue glow gradient atau generic dark mesh. Neutral base
  (`Zinc`/`Slate`/`#F0F2F5`) + aksen solid (`#1877F2`, Emerald untuk sukses).
- Dilarang card-in-card-in-card. Flat rows + `divide-y divide-[#E4E6EB]`,
  soft border, atau whitespace hierarkis.
- Skala radius konsisten: `rounded-2xl` container, `rounded-xl` form/input,
  `rounded-lg`/`rounded-xl` tombol.
- Label tombol 1–3 kata, tidak membungkus baris di desktop.
- Setiap tombol aksi/CTA punya `active:scale-[0.98]` atau `active:translate-y-[1px]`.
- Label input **di atas** input; placeholder bukan label; dilarang dua `<label>`
  untuk satu kontrol (termasuk file upload).
- Kontras WCAG AA (≥4.5:1 teks normal).
- State lengkap: loading, empty edukatif, error inline eksplisit.
- Dilarang merombak layout kontainer (mis. grid → scrollable flex) kecuali
  disyaratkan spec.
- Navigasi data-driven: daftar tab wajib array (`PUBLIC_TABS`, `DESKTOP_TABS`)
  dan test yang mengunci daftar itu; tab baru = entry array + test.

## 4. File-size: utang lama

File >400 baris yang sudah ada sebelum gate terdaftar di `GRANDFATHERED`
(`scripts/check-file-size.ts`); daftar **hanya boleh menyusut**. File di daftar
boleh disentuh untuk wiring kecil, tetapi kode fitur baru wajib lahir di file
baru yang patuh batas (contoh: tombol/badge baru → sub-komponen di
`src/components/<fitur>/`, bukan JSX inline tambahan).

## 5. Lockfile & versi Bun

Cloudflare build memakai `bun@1.2.15` (`packageManager`) dengan `--frozen-lockfile`.
Lockfile v2 dari bun lebih baru gagal dibaca. Perintah pengubah lockfile:
`npx -y bun@1.2.15 install`. Jangan upgrade `packageManager` tanpa memastikan
Cloudflare mendukungnya. Aturan ini sudah ditegakkan build deploy — reviewer
cukup memeriksa diff `bun.lock` bila ada.

## 6. D1 & pencarian: bukti di balik aturan

- Insiden Okt 2026: inbound 30 eks + transfer 7 unit = 500 di produksi padahal
  test lokal hijau. Penyebab: bulk insert/insert konkuren gagal di D1; SQLite
  lokal jauh lebih permisif. Karena itu batas 10 baris/statement dan larangan
  `Promise.all` untuk tulis bersifat mutlak, dan endpoint tulis bervolume wajib
  diuji ≥30 baris sekaligus.
- `check:d1-writes` false-negative yang disadari: `.values(chunk)` variabel,
  tulis di balik helper opaque, dan isi `db.batch([...])` — pengecualian resmi
  lewat `REGISTERED_EXCEPTIONS`.
- Pencarian: target 10rb murid, p95 <500ms di D1. `SELECT`-all + `.filter()` di
  JS dilarang; substring `%q%` endpoint publik wajib terpartisi `school_id = ?`
  + `LIMIT`; endpoint staf sentral boleh global tetapi tetap `WHERE` SQL +
  `LIMIT 50`. FTS5 hanya tahap 2 setelah `EXPLAIN QUERY PLAN` masih `SCAN` dan
  p95 >500ms, dan query-nya token-prefix (`salsa*`), bukan `%...%`.
- Kelas cacat #109: read list `WHERE school_id = ?` tanpa indeks pendahulu jadi
  `SCAN`; dulu lolos karena audit hanya memandang pencarian substring.

## 7. Edit anchor: sinyal review

Jangkar edit satu baris generik (`});`, `}`, `return ...`, baris kosong) di
tool-call adalah **red flag**. Yang pernah terjadi: `replaceAll "../../db"`
menimpa `"../../../db/schema"` menjadi `"../../../../db/schema"` karena prefix
pendek cocok di dalam hasil prefix panjang. Untuk `replaceAll` path bertingkat,
sertakan kutip penutup dan ganti path terpanjang lebih dulu.

## 8. Lane manifest (pola paralel)

`docs/agents/lanes.json` (gitignored, transient) berformat
`{ base?: string, lanes: [{ id, files[] }] }`; contoh dilacak di
`docs/agents/lanes.example.json`. Setiap file milik tepat satu lane; file
bersama (`schema.ts`, `public-orders.ts`, `settings*.ts`, `drizzle/**`)
dialokasikan ke satu lane. Lane dilarang `git add/commit/checkout`, dilarang
`lint`/`build`/`bun test` penuh — hanya `bun test <file>`; `type-check`
read-only boleh, perbaiki hanya file lane sendiri. Commit + gate repo-wide
dijalankan serial oleh agent utama.

## 9. Insiden yang membentuk aturan

| Insiden | Aturan turunan |
|---|---|
| 180 sekolah sampah dari QA ke production | §6 `AGENTS.md` (anti-polusi D1, `isTestSeedValue`, alarm cron) |
| Inbound 30 eks → 500 di D1 | §10 `AGENTS.md` (chunk, batch, error mapping, uji volume) |
| Form refund publik menembak endpoint tak ada + endpoint staf | §0.1 (`check:api-contract`) |
| Tab portal rusak saat menambah tab, semua gate hijau | §0.2 (nav data-driven + test) |
| Fitur refund publik hidup seminggu tanpa pintu masuk | §0.3 (uji entry point) |
| `});` menghapus blok salah | §12 `AGENTS.md` + §7 di sini |
| Dua commit nyasar ke `main` | §4.8 `AGENTS.md` + branch guard pre-commit |
