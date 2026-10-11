// Dead-export gate: gagalkan (exit 1) bila ada export bernama di src yang tidak
// dirujuk di mana pun — bukan file lain, bukan pula sisa file-nya sendiri di luar
// pernyataan deklarasinya. Menegakkan disiplin YAGNI §8 ("kode mati wajib dihapus
// beserta test-nya") secara mekanis. Dijalankan via `bun run check:dead`,
// pre-commit, dan CI (lihat .github/workflows/checks.yml).
//
// Batasan yang disengaja (konservatif ke arah false-negative, bukan false-positive):
// - Tipe yang dipakai di signature fungsi modulnya sendiri dianggap hidup
//   (contoh: `DiscretionInput` di signature `applyDiscretion`) — idiom inferensi
//   pemanggil tanpa anotasi eksplisit bukan kode mati.
// - Rujukan = kemunculan kata `\bNAME\b`; string/komentar ikut dihitung.
// - `export default`, `export *`, dan entry tanpa pengimpor by-design
//   (src/main.tsx, src/server/worker.ts) dikecualikan.
// - Test (`*.test.ts`), skema, seed, dan `*.d.ts` bukan definisi yang diperiksa,
//   tapi tetap dihitung sebagai perujuk.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "src";
const EXCLUDE_DEF = [
  /\.test\.(ts|tsx)$/,
  /(^|\/)db\/schema\.ts$/,
  /(^|\/)server\/seed\.ts$/,
  /\.d\.ts$/,
];
// Modul entry: export-nya dikonsumsi runtime (Vite/Wrangler), bukan import.
const ENTRY_FILES = new Set(["src/main.tsx", "src/server/worker.ts"]);

const norm = (p: string) => p.replace(/\\/g, "/");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(norm(full));
  }
  return out;
}

// export const NAME / export function NAME / export class NAME /
// export interface NAME / export type NAME / export enum NAME (+ async/abstract)
const DECL_PATTERN = /^export\s+(?:async\s+|abstract\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
// export { A, B as C } / export type { A } — ambil nama lokal (sesudah `as` bila ada)
const LIST_PATTERN = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;

interface Def {
  name: string;
  /** Indeks baris (0-based) yang ditempati pernyataan deklarasi export ini. */
  declLines: Set<number>;
}

/** Baris-baris pernyataan deklarasi: dari garis `export` sampai penutup statement. */
function statementLines(lines: string[], start: number): Set<number> {
  const out = new Set<number>([start]);
  const first = lines[start];
  // Satu baris bila diakhiri `;` tanpa blok terbuka, atau tanpa `{` sama sekali.
  if (!first.includes("{") || (first.includes("}") && first.includes(";"))) return out;
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    out.add(i);
    if (depth <= 0) break;
  }
  return out;
}

const files = walk(SRC);
const texts = new Map<string, string>(files.map((f) => [f, readFileSync(f, "utf8")]));
const linesByFile = new Map<string, string[]>(files.map((f) => [f, texts.get(f)!.split("\n")]));

const defs = new Map<string, Def[]>();
for (const [file, text] of texts) {
  if (EXCLUDE_DEF.some((re) => re.test(file)) || ENTRY_FILES.has(file)) continue;
  const lines = linesByFile.get(file)!;
  const list: Def[] = [];
  for (const m of text.matchAll(DECL_PATTERN)) {
    const start = text.slice(0, m.index).split("\n").length - 1;
    list.push({ name: m[1], declLines: statementLines(lines, start) });
  }
  for (const m of text.matchAll(LIST_PATTERN)) {
    const start = text.slice(0, m.index).split("\n").length - 1;
    for (const part of m[1].split(",")) {
      const name = (part.split(/\s+as\s+/).pop() || "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) list.push({ name, declLines: new Set([start]) });
    }
  }
  if (list.length > 0) defs.set(file, list);
}

interface DeadExport {
  file: string;
  line: number;
  name: string;
}

const dead: DeadExport[] = [];
for (const [file, list] of defs) {
  const lines = linesByFile.get(file)!;
  for (const { name, declLines } of list) {
    const pattern = new RegExp(`\\b${name}\\b`);
    // 1. Dirujuk file lain?
    let used = false;
    for (const [other, text] of texts) {
      if (other === file) continue;
      if (pattern.test(text)) {
        used = true;
        break;
      }
    }
    // 2. Dirujuk sisa file sendiri di luar deklarasinya (mis. di signature)?
    if (!used) {
      used = lines.some((text, i) => !declLines.has(i) && pattern.test(text));
    }
    if (!used) {
      dead.push({ file, line: Math.min(...declLines) + 1, name });
    }
  }
}

if (dead.length > 0) {
  console.error("Dead-export gate FAILED — export tanpa perujuk (hapus beserta test-nya, §8 YAGNI):");
  for (const d of dead.sort((a, b) => (a.file < b.file ? -1 : a.line - b.line))) {
    console.error(`  ${d.file}:${d.line}  →  '${d.name}'`);
  }
  console.error("Pengecualian: `export default`, `export *`, entry, dan tipe yang dipakai signature modulnya sendiri.");
  process.exit(1);
}

console.log("Dead-export gate OK: semua export bernama punya perujuk.");
