// Import-depth gate: gagalkan (exit 1) bila ada import relatif di src/ yang
// (a) keluar dari direktori src/, atau (b) menunjuk ke file yang tidak ada.
// Menangkap corrupt hasil replaceAll prefix bertingkat (mis. "../../db"
// yang menimpa "../../../db/schema" menjadi "../../../../db/schema").
// Dijalankan via `bun run check:imports` (lihat AGENTS.md aturan 12).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve, sep } from "node:path";

const SRC = "src";
const SPEC_RE = /["'](\.{1,2}\/[^"']*)["']/g;

const norm = (p: string) => p.replace(/\\/g, "/");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(norm(full));
    }
  }
  return out;
}

const srcAbs = resolve(SRC) + sep;

const candidates = (base: string): string[] => {
  const noExt = base.endsWith(".ts") || base.endsWith(".tsx") ? [base] : [`${base}.ts`, `${base}.tsx`];
  return [base, ...noExt, join(base, "index.ts"), join(base, "index.tsx")];
};

interface Offender {
  file: string;
  line: number;
  spec: string;
  reason: string;
}

const offenders: Offender[] = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    // Hanya modul specifier: string path di luar statement import/export
    // (mis. "./data/inventory.db") bukan import dan wajib diabaikan.
    if (!/\b(import|export)\b/.test(text)) return;
    SPEC_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SPEC_RE.exec(text)) !== null) {
      const spec = m[1];
      const target = normalize(resolve(dirname(resolve(file)), spec));
      if (!target.startsWith(srcAbs)) {
        offenders.push({ file, line: i + 1, spec, reason: "keluar dari src/" });
        continue;
      }
      if (!candidates(target).some((c) => { try { return statSync(c).isFile(); } catch { return false; } })) {
        offenders.push({ file, line: i + 1, spec, reason: "target tidak ada" });
      }
    }
  });
}

if (offenders.length > 0) {
  console.error("Import-depth gate FAILED (import relatif keluar src/ atau target tak ada):");
  for (const o of offenders) console.error(`  ${o.file}:${o.line}  "${o.spec}"  (${o.reason})`);
  process.exit(1);
}

console.log("Import-depth gate OK: seluruh import relatif di src/ valid.");
