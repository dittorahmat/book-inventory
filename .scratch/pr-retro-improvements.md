## Ringkasan Perubahan

Menerapkan tindak lanjut retrospektif untuk memperkuat guardrail mekanis dan mengurangi beban konteks agen:
1. **Pendaftaran Helper Kanonik pada Gate Mekanis (`scripts/check-canonical-helpers.ts`)**: Mendaftarkan `calculateDedupMetrics` (`src/lib/intake-dedup.ts`) ke dalam gate `check:canonical-helpers` agar kalkulasi deduplikasi tidak dapat diduplikasi secara inline di file manapun.
2. **Progressive Disclosure Dokumentasi Domain (`docs/agents/rules-intake.md`)**: Mengekstrak detail implementasi dan checklist boundary test deduplikasi ke dalam referensi terpisah, mencegah context bloat di root repo.
3. **Pembaruan Mandat Anti-Kambuh AGENTS.md §0.56**: Menambahkan aturan disiplin uji batas preview dan menghubungkannya dengan gate mekanis serta pointer progresif ke `docs/agents/rules-intake.md`.

## Verifikasi
- Gate mekanis lolos: `bun run check:canonical-helpers` dan `bun run check:fast`.
