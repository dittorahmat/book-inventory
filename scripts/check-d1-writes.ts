// Gate disiplin tulis Cloudflare D1 (§10 AGENTS.md): menjadikan §10.1 (satu
// statement INSERT maksimal 10 baris) dan §10.2 (dilarang `Promise.all` untuk
// tulis) bisa diverifikasi mesin, bukan hanya prosa. Vektor nyata (Okt 2026):
// inbound 30 eks + transfer 7 unit membalas 500 di production padahal test lokal
// hijau — SQLite lokal (bun-sqlite) jauh lebih permisif daripada D1. Seam
// kanonik ada di `src/server/lib/d1-write.ts` (D1_WRITE_CHUNK_SIZE, chunkRows,
// runWriteBatch); gate ini memastikan tak ada tulis volume yang melewatinya.
// Pemakaian: `bun scripts/check-d1-writes.ts` — exit 1 + laporan bila melanggar.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface Exception {
  /** Path relatif ber-garis-miring, mis. `src/server/services/foo.ts`. */
  file: string;
  rule: "R1" | "R2";
  /** Alasan pembenaran — tanpa ini, jangan tambahkan pengecualian. */
  reason: string;
}

/**
 * Pengecualian yang sengaja dibisukan (pola mirip `REGISTERED_SEARCH_SOURCES`).
 * Sengaja KOSONG: sampai ada kasus sah, setiap temuan adalah pelanggaran §10.
 */
export const REGISTERED_EXCEPTIONS: Exception[] = [];

/** Batas baris per statement INSERT (§10.1 — budget bound-parameter D1). */
const MAX_ROWS_PER_INSERT = 10;

/** Panggilan tulis Drizzle: `.insert(`, `.update(`, `.delete(`. */
const WRITE_CALL = /\.(insert|update|delete)\s*\(/;

/** Mask karakter sumber: 0 = komentar, 1 = kode, 2 = string/template. */
type CharMask = Uint8Array;

const CODE = 1;
const STRING = 2;

/**
 * Penanda kode vs string vs komentar. Wajib karena string/komentar bisa
 * memuat `[`, `]`, `,`, atau teks `.insert(` yang bukan kode — tanpa mask,
 * scanner bracket akan salah menghitung dan gate jadi palsu.
 */
const buildMask = (src: string): CharMask => {
  const mask = new Uint8Array(src.length);
  type State = "code" | "single" | "double" | "template" | "line" | "block";
  let state: State = "code";
  /** Kedalaman `{` saat ini — untuk menutup `${ ... }` template literal. */
  let braceDepth = 0;
  /** Kedalaman `{` yang diharapkan saat keluar dari tiap ekspresi `${`. */
  const templateExpr: number[] = [];

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (state === "line") {
      if (ch === "\n") state = "code";
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i++;
      }
      continue;
    }
    if (state === "single" || state === "double") {
      mask[i] = STRING;
      if (ch === "\\") {
        mask[i + 1] = STRING;
        i++;
      } else if ((state === "single" && ch === "'") || (state === "double" && ch === '"')) {
        state = "code";
      }
      continue;
    }
    if (state === "template") {
      mask[i] = STRING;
      if (ch === "\\") {
        mask[i + 1] = STRING;
        i++;
      } else if (ch === "`") {
        state = "code";
      } else if (ch === "$" && next === "{") {
        // Masuk ekspresi `${ ... }`: `{` di-skip (dihitung manual sebagai brace
        // pembuka) dan state kembali "code" sampai `}` penutupnya.
        templateExpr.push(braceDepth + 1);
        braceDepth++;
        state = "code";
        i++;
      }
      continue;
    }

    // state === "code"
    if (ch === "/" && next === "/") {
      state = "line";
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      state = "block";
      i++;
      continue;
    }
    if (ch === "'") {
      mask[i] = STRING;
      state = "single";
      continue;
    }
    if (ch === '"') {
      mask[i] = STRING;
      state = "double";
      continue;
    }
    if (ch === "`") {
      mask[i] = STRING;
      state = "template";
      continue;
    }
    if (ch === "{") braceDepth++;
    if (ch === "}") {
      if (templateExpr.length > 0 && templateExpr[templateExpr.length - 1] === braceDepth) {
        templateExpr.pop();
        state = "template";
        continue;
      }
      braceDepth--;
    }
    mask[i] = CODE;
  }
  return mask;
};

/** Teks dengan indeks identik: `keep` = CODE → sisakan kode saja; STRING → sisakan kode + string. */
const visibleText = (src: string, mask: CharMask, keep: number): string =>
  Array.from(src, (ch, i) => (keep === STRING ? (mask[i] === 0 ? " " : ch) : mask[i] === CODE ? ch : " ")).join("");

interface Violation {
  rule: "R1" | "R2";
  /** Indeks karakter di sumber asli (untuk nomor baris). */
  index: number;
  detail: string;
}

/** Hitung elemen top-level array literal yang dibuka di `openIndex`. */
const scanArrayLiteral = (code: string, content: string, openIndex: number): number | null => {
  let depth = 0;
  let commas = 0;
  let prevNonSpace = "";
  let endIndex = -1;
  for (let i = openIndex; i < code.length; i++) {
    const ch = code[i];
    if (/\s/.test(ch)) continue;
    if (ch === "[" || ch === "(" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === ")" || ch === "}") {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    } else if (ch === "," && depth === 1) {
      commas++;
    }
    prevNonSpace = ch;
  }
  if (endIndex < 0) return null; // tidak seimbang — bukan array literal utuh, lewati
  if (content.slice(openIndex + 1, endIndex).trim() === "") return 0;
  return prevNonSpace === "," ? commas : commas + 1; // koma ekor tidak menambah elemen
};

/** Indeks tepat setelah `)` penutup yang memasangkan `openIndex`; -1 bila tak seimbang. */
const matchParen = (code: string, openIndex: number): number => {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
};

/** R1: `.values([ ... ])` literal dengan lebih dari MAX_ROWS_PER_INSERT elemen (§10.1). */
const findChunkViolations = (code: string, content: string): Violation[] => {
  const out: Violation[] = [];
  for (const m of code.matchAll(/\.values\s*\(/g)) {
    // `Object.values([...])` bukan tulis Drizzle — hindari positif palsu.
    if (/Object\s*$/.test(code.slice(Math.max(0, m.index - 8), m.index))) continue;
    const openParen = m.index + m[0].length - 1;
    let i = openParen + 1;
    while (i < code.length && /\s/.test(code[i])) i++;
    if (code[i] !== "[") continue; // argumen non-literal (`.values(rows)`) tak bisa diukur
    const elements = scanArrayLiteral(code, content, i);
    if (elements === null || elements <= MAX_ROWS_PER_INSERT) continue;
    out.push({
      rule: "R1",
      index: m.index,
      detail: `.values([...]) berisi ${elements} baris > ${MAX_ROWS_PER_INSERT} — potong dengan chunkRows() (D1_WRITE_CHUNK_SIZE) dari server/lib/d1-write (§10.1).`,
    });
  }
  return out;
};

/** R2: `Promise.all`/`Promise.allSettled` yang argumennya memuat panggilan tulis Drizzle (§10.2). */
const findConcurrencyViolations = (code: string): Violation[] => {
  const out: Violation[] = [];
  for (const m of code.matchAll(/Promise\s*\.\s*(all|allSettled)\s*\(/g)) {
    const openParen = m.index + m[0].length - 1;
    const end = matchParen(code, openParen);
    if (end < 0) continue;
    const span = code.slice(openParen + 1, end - 1);
    const write = WRITE_CALL.exec(span);
    if (!write) continue;
    out.push({
      rule: "R2",
      index: m.index,
      detail: `Promise.${m[1]}(...) memuat tulis Drizzle (\`${write[0].replace(/\s*\($/, "(")}\`) — tulis D1 wajib sekuensial atau satu db.batch(); pakai runWriteBatch() dari server/lib/d1-write (§10.2).`,
    });
  }
  return out;
};

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      // Test dikecualikan: mereka menyemai 25–30 baris di bun-sqlite, bukan D1.
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
};

const lineOf = (src: string, index: number): number => src.slice(0, index).split("\n").length;

interface Finding {
  file: string;
  line: number;
  rule: "R1" | "R2";
  detail: string;
}

const files = walk("src");
const findings: Finding[] = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const mask = buildMask(src);
  const code = visibleText(src, mask, CODE);
  const content = visibleText(src, mask, STRING);
  for (const v of [...findChunkViolations(code, content), ...findConcurrencyViolations(code)]) {
    if (REGISTERED_EXCEPTIONS.some((e) => e.file === file && e.rule === v.rule)) continue;
    findings.push({ file, line: lineOf(src, v.index), rule: v.rule, detail: v.detail });
  }
}
findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));

if (findings.length > 0) {
  console.error("D1-write gate FAILED:");
  for (const f of findings) console.error(`  ${f.file}:${f.line} [${f.rule}] ${f.detail}`);
  console.error("Aturan §10 AGENTS.md: maksimal 10 baris per statement INSERT dan dilarang `Promise.all` untuk tulis.");
  console.error("Pakai seam kanonik src/server/lib/d1-write.ts (chunkRows, runWriteBatch) — atau daftarkan pengecualian di REGISTERED_EXCEPTIONS bila memang sah.");
  process.exit(1);
}

console.log(`D1-write gate OK: ${files.length} file dipindai, tanpa pelanggaran §10.1/§10.2.`);
