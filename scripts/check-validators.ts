// Validators gate: gagalkan (exit 1) bila skema route mendefinisikan identifier
// dengan `z.string().min(1)` telanjang (tanpa pesan) alih-alih kanonik `idSchema`
// dari src/server/lib/validators.ts. Cakupan sengaja sempit: hanya key `*Id`/`*Ids`
// (posisi identifier) — field non-ID (title/author/academicYear) dan varian
// bermessage (pesan UX) dibiarkan. Dijalankan via `bun run check:validators`,
// pre-commit, dan CI (lihat .github/workflows/checks.yml).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = "src/server/routes";
// Bare = tutup paren tepat setelah 1 (boleh spasi): `min(1)`, `min(1).optional()`.
// Varian bermessage `min(1, "...")` tidak cocok pola ini dan selalu dikecualikan.
const KEY_PATTERN = /(\w+)\s*:\s*[^:]*z\.string\(\)\.min\(1\s*\)/;
const isIdentifierKey = (key: string): boolean => key === "id" || /Ids?$/.test(key);

interface Offender {
  file: string;
  line: number;
  key: string;
}

const offenders: Offender[] = [];
for (const entry of readdirSync(ROUTES_DIR).sort()) {
  if (!/\.ts$/.test(entry) || /\.test\.ts$/.test(entry)) continue;
  const lines = readFileSync(join(ROUTES_DIR, entry), "utf8").split("\n");
  lines.forEach((text, i) => {
    const key = text.match(KEY_PATTERN)?.[1];
    if (key && isIdentifierKey(key)) offenders.push({ file: `${ROUTES_DIR}/${entry}`, line: i + 1, key });
  });
}

if (offenders.length > 0) {
  console.error("Validators gate FAILED — identifier telanjang (pakai idSchema dari ../lib/validators):");
  for (const o of offenders) console.error(`  ${o.file}:${o.line}  →  key '${o.key}'`);
  console.error("Pengecualian: varian bermessage (pesan UX) dan field non-*Id dibiarkan.");
  process.exit(1);
}

console.log("Validators gate OK: semua identifier route memakai idSchema.");
