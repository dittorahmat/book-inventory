// Gate isolasi test (AGENTS.md §6): `bun test` WAJIB berjalan di file SQLite
// sementara (test/setup.ts via `[test] preload`), dilarang menyentuh D1.
// Vektor nyata (Okt 2026): 180 sekolah sampah berisi data test bocor ke D1
// production karena tidak ada satu pun gate yang menegakkan aturan ini —
// saat itu isolasi hanya "disiplin", bukan mesin. Gate ini menutup celah itu:
//   B1  tidak ada binding D1 (`env.DB`, `D1Database`, workers-types, Miniflare,
//       wrangler, getPlatformProxy) di file test mana pun.
//   B2  `bunfig.toml` masih memuat `[test] preload = ["./test/setup.ts"]`.
//   B3  `test/setup.ts` masih mengarahkan DB lewat `process.env.DB_PATH`.
// Dijalankan via `bun scripts/check-test-isolation.ts`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const norm = (p: string) => p.replace(/\\/g, "/");

/** Pola binding/lingkungan D1 yang DILARANG muncul di file test (§6). */
const FORBIDDEN: Array<{ label: string; re: RegExp }> = [
  { label: "env.DB", re: /\benv\.DB\b/ },
  { label: "D1Database", re: /\bD1Database\b/ },
  { label: "@cloudflare/workers-types", re: /@cloudflare\/workers-types/ },
  { label: "getPlatformProxy", re: /\bgetPlatformProxy\b/ },
  { label: "Miniflare", re: /\bMiniflare\b/ },
  { label: "wrangler", re: /\bwrangler\b/ },
];

/** Kumpulkan file test: `src/**` (hanya *.test.ts/tsx) + `test/**` (semua *.ts). */
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (dir === "test" ? /\.ts$/.test(entry) : /\.test\.tsx?$/.test(entry)) {
      out.push(norm(full));
    }
  }
  return out;
}

const testFiles = [...walk("src"), ...walk("test")].sort();
const hits: string[] = [];

// B1 — tidak ada binding D1 di file test.
for (const file of testFiles) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    for (const { label, re } of FORBIDDEN) {
      if (re.test(text)) hits.push(`${file}:${i + 1}: ${label}`);
    }
  });
}

// B2 — preload isolasi wajib utuh di bunfig.toml.
const bunfig = existsSync("bunfig.toml") ? readFileSync("bunfig.toml", "utf8").split("\n") : [];
const testSectionStart = bunfig.findIndex((l) => l.trim() === "[test]");
const testSection = testSectionStart < 0 ? "" : bunfig.slice(testSectionStart + 1).join("\n").split(/^\[/m)[0];
const preloadList = /preload\s*=\s*\[([\s\S]*?)\]/.exec(testSection)?.[1] ?? "";
const hasPreload = preloadList.includes(`"./test/setup.ts"`) || preloadList.includes(`'./test/setup.ts'`);
if (!hasPreload) {
  hits.push(
    `bunfig.toml: preload ./test/setup.ts hilang — preload isolasi test wajib ada; ` +
      "DILARANG menonaktifkannya tanpa pengganti setara (AGENTS.md §6)."
  );
}

// B3 — setup masih mengarahkan DB ke file sementara.
const setupPath = "test/setup.ts";
if (!existsSync(setupPath) || !readFileSync(setupPath, "utf8").includes("process.env.DB_PATH")) {
  hits.push(`${setupPath}: wajib ada dan memuat \`process.env.DB_PATH\` (pengalih ke DB test sementara).`);
}

// B4 — isolasi actor mock (AGENTS.md §0.40): setiap file yang memanggil mockActor wajib memanggil restoreActor.
for (const file of testFiles) {
  const content = readFileSync(file, "utf8");
  if (content.includes("mockActor(") && !content.includes("restoreActor")) {
    hits.push(`${file}: memanggil mockActor() tetapi tidak memuat restoreActor (risiko kebocoran sesi antar test).`);
  }
}

// B5 — disiplin otomasi browser & mutasi aktif (AGENTS.md §0.25 & §0.42):
// Script demo Playwright di scripts/demo-scenarios/ tidak boleh memanggil raw fetch tanpa autentikasi ke /api/demo/seed.
const demoScriptDir = "scripts/demo-scenarios";
if (existsSync(demoScriptDir)) {
  for (const entry of readdirSync(demoScriptDir)) {
    if (/\.ts$/.test(entry)) {
      const p = join(demoScriptDir, entry);
      const content = readFileSync(p, "utf8");
      if (/fetch\([^)]*\/api\/demo\/seed/.test(content)) {
        hits.push(`${p}: memanggil raw fetch() ke /api/demo/seed tanpa otentikasi sesi Central Admin.`);
      }
    }
  }
}

// B6 — isolasi fixture entitas test (AGENTS.md §6 & §0.51.7):
// Setiap test file yang melakukan insert data ke DB wajib membersihkan relasinya di afterEach/finally
// atau menggunakan factory isolasi (createTest*) guna mencegah polusi antar-suite pada 'bun test' paralel.
const ENTITY_INSERT_RE = new RegExp(
  "\\.(?:insert)\\s*\\(\\s*(?:schools|books|bookStocks|uniformStock)\\s*\\)"
);
for (const file of testFiles) {
  const content = readFileSync(file, "utf8");
  if (
    ENTITY_INSERT_RE.test(content) &&
    !content.includes("afterEach") &&
    !content.includes("finally") &&
    !content.includes("onConflictDoUpdate") &&
    !content.includes("onConflictDoNothing") &&
    !content.includes("cleanDatabase") &&
    !content.includes("resetTestDb")
  ) {
    // Flagging test files that insert persistent state without lifecycle cleanup
    hits.push(`${file}: melakukan insert entitas (schools/books/stocks) tanpa afterEach/finally cleanup hook.`);
  }
}

// B7 — larangan penghapusan tabel master tanpa klausa WHERE (AGENTS.md §6.1 / Issue #454 / #456):
// Pemanggilan `db.delete(<table>)` tanpa `.where(...)` menghapus seluruh isi tabel master
// (seperti bookPackages, books, schools, students, uniformVariants) yang merusak baseline data test runner.
const MASTER_TABLES = [
  "bookPackages",
  "books",
  "schools",
  "students",
  "uniformVariants",
  "uniformPackages",
  "uniformSizes",
];
const UNQUALIFIED_DELETE_RE = new RegExp(
  `\\.delete\\s*\\(\\s*(${MASTER_TABLES.join("|")})\\s*\\)(?!\\s*\\.where\\b)`
);

// Pengecualian legal (mis. test khusus reset katalog paket yang dijamin membungkus dalam try...finally runIdempotentSeed)
const UNQUALIFIED_DELETE_ALLOWLIST = new Set([
  "src/server/routes/packages.test.ts", // test: tidak memicu seed demo untuk peran non-pusat saat katalog paket kosong (restored in finally)
]);

for (const file of testFiles) {
  if (UNQUALIFIED_DELETE_ALLOWLIST.has(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    const match = UNQUALIFIED_DELETE_RE.exec(text);
    if (match) {
      hits.push(
        `${file}:${i + 1}: pemanggilan db.delete(${match[1]}) tanpa klausa .where(...) dilarang karena merusak baseline master test (Issue #456).`
      );
    }
  });
}

if (hits.length > 0) {
  console.error("Test-isolation gate FAILED:");
  for (const hit of hits) console.error(`  ${hit}`);
  console.error(
    "AGENTS.md §6: `bun test` wajib di DB sementara terisolasi, DILARANG menunjuk D1 (remote/lokal) " +
      "dan DILARANG menonaktifkan preload test/setup.ts tanpa pengganti setara."
  );
  process.exit(1);
}

console.log(`Test-isolation gate OK: ${testFiles.length} file test dipindai, preload isolasi utuh.`);
