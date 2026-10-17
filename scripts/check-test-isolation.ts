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
