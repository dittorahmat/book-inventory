// Lane-ownership gate (§4.4/§4.5 AGENTS.md): pola "parallel write lanes"
// (beberapa subagent implementer file-disjoint di SATU working tree) sebelumnya
// hanya bertumpu pada kesepakatan honor-system "satu file milik tepat satu lane".
// Gate ini mengubah kesepakatan itu jadi mesin: setiap file yang berubah WAJIB
// tercakup minimal satu allowlist lane.
// Manifest per-sesi bersifat transient & gitignored: `docs/agents/lanes.json`
// (contoh format di `docs/agents/lanes.example.json`). Bila manifest tidak ada
// (run single-agent biasa / CI) gate SKIP — perilaku hari ini utuh.
// Dijalankan via `bun run check:lanes`, di dalam `check:all`, pre-commit, dan CI.
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

interface Lane {
  id: string;
  files: string[];
}

interface Manifest {
  base?: string;
  lanes?: unknown;
}

// Urutan resolusi: `--manifest=<path>` → env LANE_MANIFEST → default.
const MANIFEST =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice("--manifest=".length) ??
  process.env.LANE_MANIFEST ??
  "docs/agents/lanes.json";

const norm = (path: string): string => path.replace(/\\/g, "/");

const sh = (cmd: string): string | null => {
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch {
    return null;
  }
};

/** Glob kecil tanpa dependensi: `**`→`.*`, `*`→`[^/]*`, `?`→`[^/]`, trailing `/` = `/**`. */
const globToRegExp = (glob: string): RegExp => {
  const pattern = glob.endsWith("/") ? `${glob}**` : glob;
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      out += ".*";
      i++;
    } else if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
};

/** Lane valid = `id` string non-kosong + `files` array string non-kosong. */
const isLane = (value: unknown): value is Lane => {
  const lane = value as { id?: unknown; files?: unknown };
  return (
    typeof lane?.id === "string" &&
    lane.id.length > 0 &&
    Array.isArray(lane.files) &&
    lane.files.length > 0 &&
    lane.files.every((file) => typeof file === "string")
  );
};

const linesOf = (cmd: string): string[] =>
  (sh(cmd) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

if (!existsSync(MANIFEST)) {
  console.log(`Lane-ownership gate SKIP: tidak ada manifest lane (${MANIFEST}).`);
  process.exit(0);
}

if (sh("git rev-parse --is-inside-work-tree") === null) {
  console.log("Lane-ownership gate SKIP: bukan repo git — lewati.");
  process.exit(0);
}

let manifest: Manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
} catch (error) {
  console.error(`Lane-ownership gate FAILED: manifest lane (${MANIFEST}) bukan JSON valid.`);
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const rawLanes = manifest.lanes;
if (!Array.isArray(rawLanes) || rawLanes.length === 0) {
  console.error(`Lane-ownership gate FAILED: manifest lane (${MANIFEST}) wajib punya "lanes": [...] non-kosong.`);
  process.exit(1);
}

const lanes = rawLanes.filter(isLane);
if (lanes.length !== rawLanes.length) {
  console.error(`Lane-ownership gate FAILED: setiap lane wajib punya "id" dan "files" non-kosong (${MANIFEST}).`);
  for (const lane of rawLanes.filter((value) => !isLane(value))) {
    console.error(`  lane tidak valid: ${JSON.stringify(lane)}`);
  }
  process.exit(1);
}

const globs = lanes.flatMap((lane) => lane.files.map(globToRegExp));
const covered = (file: string): boolean => globs.some((re) => re.test(file));

const changed = new Set<string>();
for (const file of linesOf("git diff --name-only")) changed.add(norm(file));
for (const file of linesOf("git diff --cached --name-only")) changed.add(norm(file));
for (const file of linesOf("git ls-files --others --exclude-standard")) changed.add(norm(file));
if (manifest.base) {
  for (const file of linesOf(`git diff --name-only ${manifest.base}...HEAD`)) changed.add(norm(file));
}

const offenders = [...changed].filter((file) => !covered(file)).sort();
if (offenders.length > 0) {
  console.error("Lane-ownership gate FAILED — file di luar allowlist lane mana pun:");
  for (const file of offenders) console.error(`  ${file}`);
  console.error("Tambahkan file ke lane yang tepat (docs/agents/lanes.json) atau rutenya lewat lane agent utama (AGENTS.md §4.5).");
  process.exit(1);
}

console.log(`Lane-ownership gate OK: ${changed.size} file diperiksa, ${lanes.length} lane.`);
